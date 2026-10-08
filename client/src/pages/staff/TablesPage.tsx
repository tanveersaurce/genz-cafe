import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  QrCode,
  Download,
  Printer,
  Edit2,
  CheckCircle,
  XCircle,
  Users,
  Filter,
  AlertCircle,
  Coffee,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { apiClient, ApiClientError } from '@/lib/apiClient';
import { siteConfig } from '@/config/siteConfig';

export interface TableItem {
  _id: string;
  tableNumber: number;
  label: string;
  capacity: number;
  zone: 'indoor' | 'outdoor' | 'window' | 'family' | 'other';
  isReservable: boolean;
  isActive: boolean;
  qrToken?: string;
  qrTokenRotatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const ZONE_OPTIONS = [
  { value: 'indoor', label: 'Indoor Dining' },
  { value: 'outdoor', label: 'Outdoor Patio' },
  { value: 'window', label: 'Window View' },
  { value: 'family', label: 'Family / Large' },
  { value: 'other', label: 'Other' },
];

export const TablesPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission(user?.permissions, 'tables:manage');
  const canRotate = hasPermission(user?.permissions, 'qr:rotate-token');

  // Filters
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [filterReservable, setFilterReservable] = useState<string>('all');

  // Table Create / Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [label, setLabel] = useState<string>('');
  const [capacity, setCapacity] = useState<number>(4);
  const [zone, setZone] = useState<string>('indoor');
  const [isReservable, setIsReservable] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Individual Table QR Modal
  const [qrModalTable, setQrModalTable] = useState<TableItem | null>(null);
  const [singleQrDataUrl, setSingleQrDataUrl] = useState<string>('');

  // Bulk Print Sheet Modal
  const [isPrintSheetOpen, setIsPrintSheetOpen] = useState<boolean>(false);
  const [qrDataUrlMap, setQrDataUrlMap] = useState<Record<number, string>>({});
  const [isGeneratingSheet, setIsGeneratingSheet] = useState<boolean>(false);

  // Table Status Action Error
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch Tables
  const {
    data: tables = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['staff-tables'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { tables: TableItem[] } }>('/tables');
      return res.data.tables;
    },
  });

  const [hasRotatedRecently, setHasRotatedRecently] = useState(false);

  // Generate single QR when modal opens
  useEffect(() => {
    if (qrModalTable) {
      const menuUrl = qrModalTable.qrToken
        ? `${window.location.origin}/menu?table=${qrModalTable.tableNumber}&t=${encodeURIComponent(qrModalTable.qrToken)}`
        : `${window.location.origin}/menu?table=${qrModalTable.tableNumber}`;
      QRCode.toDataURL(menuUrl, { width: 320, margin: 2 })
        .then((url) => setSingleQrDataUrl(url))
        .catch(() => setSingleQrDataUrl(''));
    }
  }, [qrModalTable]);

  // Generate QR for all tables when print sheet opens
  useEffect(() => {
    if (isPrintSheetOpen && tables.length > 0) {
      setIsGeneratingSheet(true);
      const generateAll = async () => {
        const map: Record<number, string> = {};
        for (const t of tables) {
          const menuUrl = t.qrToken
            ? `${window.location.origin}/menu?table=${t.tableNumber}&t=${encodeURIComponent(t.qrToken)}`
            : `${window.location.origin}/menu?table=${t.tableNumber}`;
          try {
            map[t.tableNumber] = await QRCode.toDataURL(menuUrl, { width: 260, margin: 1 });
          } catch {
            // Ignore error
          }
        }
        setQrDataUrlMap(map);
        setIsGeneratingSheet(false);
      };
      generateAll();
    }
  }, [isPrintSheetOpen, tables]);

  const rotateSingleMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const res = await apiClient.post<{ success: boolean; data: { table: TableItem } }>(
        `/tables/${tableId}/rotate-qr-token`
      );
      return res.data.table;
    },
    onSuccess: (updatedTable) => {
      void queryClient.invalidateQueries({ queryKey: ['staff-tables'] });
      setQrModalTable(updatedTable);
      setHasRotatedRecently(true);
    },
  });

  const rotateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ success: boolean; data: { count: number } }>(
        '/tables/rotate-all-qr-tokens'
      );
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-tables'] });
      setHasRotatedRecently(true);
    },
  });

  // Mutations
  const createTableMutation = useMutation({
    mutationFn: async (payload: {
      tableNumber: number;
      label: string;
      capacity: number;
      zone: string;
      isReservable: boolean;
    }) => {
      return apiClient.post('/tables', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tables'] });
      setIsEditModalOpen(false);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create table');
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        label?: string;
        capacity?: number;
        zone?: string;
        isReservable?: boolean;
      };
    }) => {
      return apiClient.patch(`/tables/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tables'] });
      setIsEditModalOpen(false);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to update table');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiClient.patch(`/tables/${id}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-tables'] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Could not update table status. Tables with active future bookings cannot be deactivated.';
      setActionError(msg);
    },
  });

  const handleOpenCreateModal = () => {
    setEditingTable(null);
    const maxNum = tables.reduce((max, t) => Math.max(max, t.tableNumber), 0);
    setTableNumber(maxNum + 1);
    setLabel(`Table ${maxNum + 1}`);
    setCapacity(4);
    setZone('indoor');
    setIsReservable(true);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEditModal = (t: TableItem) => {
    setEditingTable(t);
    setTableNumber(t.tableNumber);
    setLabel(t.label);
    setCapacity(t.capacity);
    setZone(t.zone);
    setIsReservable(t.isReservable);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (editingTable) {
      updateTableMutation.mutate({
        id: editingTable._id,
        payload: {
          label: label.trim(),
          capacity,
          zone,
          isReservable,
        },
      });
    } else {
      createTableMutation.mutate({
        tableNumber,
        label: label.trim(),
        capacity,
        zone,
        isReservable,
      });
    }
  };

  const handleDownloadQr = (tableNum: number, dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `table-${tableNum}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter tables
  const filteredTables = tables.filter((t) => {
    if (selectedZone !== 'all' && t.zone !== selectedZone) return false;
    if (filterReservable === 'reservable' && !t.isReservable) return false;
    if (filterReservable === 'walkin' && t.isReservable) return false;
    return true;
  });

  // Chunk tables into sets of 6 for printable A4 pages
  const chunkedForPrint: TableItem[][] = [];
  for (let i = 0; i < tables.length; i += 6) {
    chunkedForPrint.push(tables.slice(i, i + 6));
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-brand-green-950">Table & QR Management</h1>
          <p className="text-sm text-brand-ink-500">
            Configure cafe seating layout, availability zones, and generate branded contactless QR table cards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canRotate && (
            <Button
              variant="outline"
              className="gap-2 text-amber-800 border-amber-300 hover:bg-amber-50"
              onClick={() => {
                if (
                  window.confirm(
                    'Are you sure you want to rotate ALL table QR tokens? All existing printed QR codes will stop working immediately until reprinted.'
                  )
                ) {
                  rotateAllMutation.mutate();
                }
              }}
              disabled={rotateAllMutation.isPending || tables.length === 0}
            >
              <RefreshCw className={`h-4 w-4 ${rotateAllMutation.isPending ? 'animate-spin' : ''}`} />
              {rotateAllMutation.isPending ? 'Rotating...' : 'Rotate All QR Tokens'}
            </Button>
          )}

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsPrintSheetOpen(true)}
            disabled={tables.length === 0}
          >
            <Printer className="h-4 w-4" />
            Print A4 QR Sheets
          </Button>

          {canManage && (
            <Button onClick={handleOpenCreateModal} className="gap-2 bg-brand-green-800 text-brand-gold-400">
              <Plus className="h-4 w-4" />
              Add Table
            </Button>
          )}
        </div>
      </div>

      {hasRotatedRecently && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-card flex items-start gap-3 text-sm text-amber-800">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">QR Tokens Rotated</span>
            <span>
              QR codes have been rotated. Please print new QR sheets and place updated QR cards on tables.
              Old printed codes will no longer permit self-ordering.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHasRotatedRecently(false)}
            className="text-xs text-amber-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-card flex items-start gap-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Deactivation Blocked</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs text-red-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-brand-surface-card p-4 rounded-card border border-brand-cream-300 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-brand-ink-400" />
          <span className="text-xs font-semibold text-brand-ink-600 uppercase">Filters:</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-ink-500 font-medium">Zone:</span>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="text-xs border border-brand-cream-300 rounded px-2.5 py-1.5 bg-white text-brand-ink-700"
          >
            <option value="all">All Zones ({tables.length})</option>
            {ZONE_OPTIONS.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-ink-500 font-medium">Type:</span>
          <select
            value={filterReservable}
            onChange={(e) => setFilterReservable(e.target.value)}
            className="text-xs border border-brand-cream-300 rounded px-2.5 py-1.5 bg-white text-brand-ink-700"
          >
            <option value="all">All Tables</option>
            <option value="reservable">Reservable Online</option>
            <option value="walkin">Walk-in Only</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" variant="gold" />
          <span className="text-sm text-brand-ink-500">Loading tables...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 rounded-card border border-red-200 text-red-700 space-y-2">
          <p className="font-semibold">Failed to load tables</p>
          <p className="text-xs">{error instanceof Error ? error.message : 'Please try again later'}</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="p-12 text-center bg-brand-surface-card rounded-card border border-brand-cream-300 space-y-3">
          <Coffee className="h-10 w-10 text-brand-ink-300 mx-auto" />
          <p className="font-medium text-brand-ink-700">No tables match your active filters.</p>
          <p className="text-xs text-brand-ink-400">Try adjusting the zone or reservation type filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.map((table) => (
            <Card
              key={table._id}
              variant="cream"
              className={`border transition-all ${
                !table.isActive
                  ? 'opacity-60 bg-gray-50 border-gray-200'
                  : 'border-brand-cream-300 hover:border-brand-gold-500 hover:shadow-card'
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xl text-brand-green-950">
                        #{table.tableNumber}
                      </span>
                      <Badge
                        variant={table.isActive ? 'success' : 'cream'}
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {table.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <span className="text-sm font-semibold text-brand-green-900 block mt-0.5">
                      {table.label}
                    </span>
                  </div>

                  <Badge variant="cream" className="text-xs capitalize font-medium">
                    {table.zone}
                  </Badge>
                </div>

                {/* Specs row */}
                <div className="flex items-center justify-between text-xs text-brand-ink-600 pt-1 border-t border-brand-cream-200">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-brand-ink-400" />
                    <span>Capacity: {table.capacity}</span>
                  </div>
                  <div>
                    {table.isReservable ? (
                      <span className="text-emerald-700 font-medium">Online Reservable</span>
                    ) : (
                      <span className="text-amber-700 font-medium">Walk-in Only</span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 flex items-center justify-between border-t border-brand-cream-200">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs text-brand-green-900"
                    onClick={() => setQrModalTable(table)}
                  >
                    <QrCode className="h-4 w-4" />
                    QR Code
                  </Button>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs p-1.5 text-brand-ink-500 hover:text-brand-green-950"
                        onClick={() => handleOpenEditModal(table)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className={`text-xs p-1.5 ${
                          table.isActive
                            ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title={table.isActive ? 'Deactivate Table' : 'Activate Table'}
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: table._id,
                            isActive: !table.isActive,
                          })
                        }
                      >
                        {table.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingTable ? `Edit Table #${editingTable.tableNumber}` : 'Create New Table'}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-card text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {!editingTable && (
            <div>
              <label htmlFor="createTableNum" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Table Number *
              </label>
              <Input
                id="createTableNum"
                type="number"
                min={1}
                value={tableNumber}
                onChange={(e) => setTableNumber(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="tableLabel" className="block text-xs font-semibold text-brand-green-950 mb-1">
              Table Label / Location Name *
            </label>
            <Input
              id="tableLabel"
              placeholder="e.g. Window Corner 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tableCap" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Seating Capacity *
              </label>
              <Input
                id="tableCap"
                type="number"
                min={1}
                max={20}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>

            <div>
              <label htmlFor="tableZone" className="block text-xs font-semibold text-brand-green-950 mb-1">
                Zone *
              </label>
              <Select
                id="tableZone"
                options={ZONE_OPTIONS}
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isReservable}
                onChange={(e) => setIsReservable(e.target.checked)}
                className="h-4 w-4 rounded border-brand-cream-300 text-brand-green-800 focus:ring-brand-gold-500"
              />
              <span className="text-sm font-medium text-brand-ink-800">
                Reservable Online (Uncheck for walk-in only table)
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-brand-cream-200 flex justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTableMutation.isPending || updateTableMutation.isPending}
              className="bg-brand-green-800 text-brand-gold-400"
            >
              {editingTable ? 'Save Changes' : 'Create Table'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* SINGLE TABLE QR MODAL */}
      <Modal
        isOpen={!!qrModalTable}
        onClose={() => setQrModalTable(null)}
        title={`Table #${qrModalTable?.tableNumber} QR Code`}
      >
        {qrModalTable && (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-brand-surface-card rounded-card border border-brand-cream-300 inline-block shadow-soft">
              {singleQrDataUrl ? (
                <img
                  src={singleQrDataUrl}
                  alt={`Table ${qrModalTable.tableNumber} QR`}
                  className="w-48 h-48 mx-auto"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <Spinner size="md" />
                </div>
              )}
              <div className="mt-3">
                <div className="font-serif font-bold text-lg text-brand-green-950">
                  Table {qrModalTable.tableNumber}
                </div>
                <div className="text-xs text-brand-ink-500">{qrModalTable.label}</div>
              </div>
            </div>

            <div className="text-xs text-brand-ink-500 space-y-1">
              <div>Destination URL:</div>
              <code className="text-[11px] bg-brand-cream-100 px-2 py-1 rounded block overflow-hidden text-ellipsis">
                {qrModalTable.qrToken
                  ? `${window.location.origin}/menu?table=${qrModalTable.tableNumber}&t=${encodeURIComponent(qrModalTable.qrToken)}`
                  : `${window.location.origin}/menu?table=${qrModalTable.tableNumber}`}
              </code>
              {qrModalTable.qrTokenRotatedAt && (
                <div className="text-[10px] text-brand-ink-400">
                  Last rotated: {new Date(qrModalTable.qrTokenRotatedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 flex-wrap">
              {canRotate && (
                <Button
                  variant="outline"
                  className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                  disabled={rotateSingleMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Rotate QR token for Table #${qrModalTable.tableNumber}? Old printed QR will stop working immediately.`
                      )
                    ) {
                      rotateSingleMutation.mutate(qrModalTable._id);
                    }
                  }}
                >
                  <RefreshCw className={`h-4 w-4 ${rotateSingleMutation.isPending ? 'animate-spin' : ''}`} />
                  Rotate Token
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleDownloadQr(qrModalTable.tableNumber, singleQrDataUrl)}
              >
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
              <Button variant="ghost" onClick={() => setQrModalTable(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* BULK A4 PRINT SHEET MODAL */}
      <Modal
        isOpen={isPrintSheetOpen}
        onClose={() => setIsPrintSheetOpen(false)}
        title="Printable Table QR Sheet (A4 Layout)"
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="no-print flex items-center justify-between pb-3 border-b border-brand-cream-200">
            <p className="text-xs text-brand-ink-600">
              Prints 6 cards per A4 sheet with high-resolution QR codes, logo, and table instructions.
            </p>
            <Button
              className="gap-2 bg-brand-green-800 text-brand-gold-400"
              onClick={() => window.print()}
              disabled={isGeneratingSheet}
            >
              <Printer className="h-4 w-4" />
              Print Now
            </Button>
          </div>

          {/* Printable Container with Custom CSS */}
          <div id="qr-print-container" className="space-y-8">
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #qr-print-container, #qr-print-container * {
                  visibility: visible;
                }
                #qr-print-container {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  margin: 0;
                  padding: 10mm;
                  background: white;
                }
                .no-print {
                  display: none !important;
                }
                .print-page {
                  page-break-after: always;
                  height: 100%;
                  margin-bottom: 20mm;
                }
              }
            `}</style>

            {isGeneratingSheet ? (
              <div className="py-16 text-center space-y-3">
                <Spinner size="lg" variant="gold" />
                <p className="text-sm text-brand-ink-500">Preparing high-resolution QR cards...</p>
              </div>
            ) : (
              chunkedForPrint.map((pageTables, pageIndex) => (
                <div key={pageIndex} className="print-page grid grid-cols-2 gap-6">
                  {pageTables.map((t) => (
                    <div
                      key={t._id}
                      className="border-2 border-brand-green-900 rounded-2xl p-6 text-center space-y-3 bg-white flex flex-col items-center justify-between shadow-sm min-h-[300px]"
                    >
                      {/* Card Header */}
                      <div>
                        <div className="font-serif font-extrabold text-xl tracking-tight text-brand-green-950">
                          {siteConfig.name}
                        </div>
                        <div className="text-[11px] text-brand-ink-500 italic tracking-wider">
                          {siteConfig.tagline}
                        </div>
                      </div>

                      {/* QR Code */}
                      <div className="p-2 border border-brand-cream-300 rounded-xl bg-white shadow-soft">
                        {qrDataUrlMap[t.tableNumber] ? (
                          <img
                            src={qrDataUrlMap[t.tableNumber]}
                            alt={`Table ${t.tableNumber}`}
                            className="w-36 h-36 mx-auto"
                          />
                        ) : (
                          <div className="w-36 h-36 flex items-center justify-center">
                            <Spinner size="sm" />
                          </div>
                        )}
                      </div>

                      {/* Scan Prompt */}
                      <div className="space-y-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-brand-gold-600">
                          Scan to Order & Browse
                        </div>
                        <div className="font-serif font-black text-2xl text-brand-green-950">
                          Table {t.tableNumber}
                        </div>
                        <div className="text-[11px] text-brand-ink-400">{t.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
