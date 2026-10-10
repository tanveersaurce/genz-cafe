import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { FoodTypeIndicator, FoodType } from './FoodTypeIndicator';
import { rupeesToPaise } from '@/lib/formatPrice';
import { useAuth } from '@/lib/authContext';
import { hasPermission } from '@/lib/permissions';
import { Plus, Trash2, Upload, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { CategoryData } from './CategoryModal';

export interface MenuItemData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category: { _id: string; name: string; slug: string } | string;
  foodType: FoodType;
  basePrice: number; // in paise
  variants: Array<{ name: string; price: number; isDefault: boolean }>;
  gstRate: number;
  image?: { full: string; thumbnail: string };
  tags: string[];
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  preparationMinutes?: number;
}

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: MenuItemData | null;
  categories: CategoryData[];
}

const ALL_TAGS = [
  { value: 'bestseller', label: 'Bestseller' },
  { value: 'chef_special', label: "Chef's Special" },
  { value: 'new', label: 'New' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'jain', label: 'Jain' },
  { value: 'sugar_free', label: 'Sugar Free' },
];

export const MenuItemModal: React.FC<MenuItemModalProps> = ({
  isOpen,
  onClose,
  item,
  categories,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const canEditPrice = hasPermission(user?.permissions, 'menu:price');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [foodType, setFoodType] = useState<FoodType>('veg');
  const [hasVariants, setHasVariants] = useState(false);
  const [basePriceRupees, setBasePriceRupees] = useState('');
  const [variants, setVariants] = useState<Array<{ name: string; priceRupees: string; isDefault: boolean }>>([]);
  const [gstRate, setGstRate] = useState('5');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [preparationMinutes, setPreparationMinutes] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description || '');
      const catId = typeof item.category === 'object' ? item.category._id : item.category;
      setCategoryId(catId || '');
      setFoodType(item.foodType);
      setGstRate(item.gstRate.toString());
      setSelectedTags(item.tags || []);
      setIsFeatured(item.isFeatured);
      setIsAvailable(item.isAvailable);
      setPreparationMinutes(item.preparationMinutes ? item.preparationMinutes.toString() : '');
      setSortOrder(item.sortOrder.toString());

      if (item.variants && item.variants.length > 0) {
        setHasVariants(true);
        setVariants(
          item.variants.map((v) => ({
            name: v.name,
            priceRupees: (v.price / 100).toString(),
            isDefault: v.isDefault,
          }))
        );
        const defaultVar = item.variants.find((v) => v.isDefault);
        setBasePriceRupees(defaultVar ? (defaultVar.price / 100).toString() : (item.basePrice / 100).toString());
      } else {
        setHasVariants(false);
        setBasePriceRupees((item.basePrice / 100).toString());
        setVariants([{ name: 'Regular', priceRupees: (item.basePrice / 100).toString(), isDefault: true }]);
      }

      setImagePreview(item.image?.thumbnail || null);
      setImageFile(null);
      setRemoveExistingImage(false);
    } else {
      setName('');
      setDescription('');
      setCategoryId(categories[0]?.id || '');
      setFoodType('veg');
      setHasVariants(false);
      setBasePriceRupees('');
      setVariants([
        { name: 'Regular', priceRupees: '', isDefault: true },
        { name: 'Large', priceRupees: '', isDefault: false },
      ]);
      setGstRate('5');
      setSelectedTags([]);
      setIsFeatured(false);
      setIsAvailable(true);
      setPreparationMinutes('');
      setSortOrder('0');
      setImagePreview(null);
      setImageFile(null);
      setRemoveExistingImage(false);
    }
  }, [item, isOpen, categories]);

  const handleTagToggle = (tagVal: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagVal) ? prev.filter((t) => t !== tagVal) : [...prev, tagVal]
    );
  };

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      { name: '', priceRupees: '', isDefault: prev.length === 0 },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (removed?.isDefault && next.length > 0 && next[0]) {
        next[0].isDefault = true;
      }
      return next;
    });
  };

  const handleSetDefaultVariant = (index: number) => {
    setVariants((prev) =>
      prev.map((v, i) => ({ ...v, isDefault: i === index }))
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ type: 'error', title: 'File Too Large', message: 'Maximum image size is 5MB.' });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveExistingImage(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Build variants or single price
      let calculatedBasePricePaise = rupeesToPaise(basePriceRupees);
      let payloadVariants: Array<{ name: string; price: number; isDefault: boolean }> | undefined;

      if (hasVariants) {
        if (variants.length === 0) {
          throw new Error('Please add at least one variant or disable variants');
        }
        const hasDefault = variants.some((v) => v.isDefault);
        if (!hasDefault && variants[0]) {
          variants[0].isDefault = true;
        }

        payloadVariants = variants.map((v) => ({
          name: v.name.trim() || 'Standard',
          price: rupeesToPaise(v.priceRupees),
          isDefault: v.isDefault,
        }));

        const def = payloadVariants.find((v) => v.isDefault);
        if (def) {
          calculatedBasePricePaise = def.price;
        }
      }

      let savedItemId: string;

      if (item) {
        savedItemId = item.id;
        // Update general item details
        await apiClient.patch(`/menu/items/${item.id}`, {
          name,
          description: description || undefined,
          categoryId,
          foodType,
          gstRate: parseInt(gstRate, 10),
          tags: selectedTags,
          isFeatured,
          sortOrder: parseInt(sortOrder, 10) || 0,
          preparationMinutes: preparationMinutes ? parseInt(preparationMinutes, 10) : undefined,
        });

        // Update price if allowed
        if (canEditPrice) {
          if (hasVariants) {
            await apiClient.patch(`/menu/items/${item.id}/price`, {
              variants: payloadVariants,
            });
          } else {
            await apiClient.patch(`/menu/items/${item.id}/price`, {
              basePrice: calculatedBasePricePaise,
              variants: [],
            });
          }
        }
      } else {
        // Create new item
        const res = await apiClient.post<{ success: boolean; data: MenuItemData }>(
          '/menu/items',
          {
            name,
            description: description || undefined,
            categoryId,
            foodType,
            basePrice: calculatedBasePricePaise,
            variants: hasVariants ? payloadVariants : [],
            gstRate: parseInt(gstRate, 10),
            tags: selectedTags,
            isFeatured,
            isAvailable,
            sortOrder: parseInt(sortOrder, 10) || 0,
            preparationMinutes: preparationMinutes ? parseInt(preparationMinutes, 10) : undefined,
          }
        );
        savedItemId = res.data.id;
      }

      // Handle Image Upload / Delete
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await apiClient.upload(`/menu/items/${savedItemId}/image`, formData);
      } else if (removeExistingImage && item?.image) {
        await apiClient.delete(`/menu/items/${savedItemId}/image`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({
        type: 'success',
        title: item ? 'Item Updated' : 'Item Created',
        message: `"${name}" was saved successfully.`,
      });
      onClose();
    },
    onError: (err: Error) => {
      toast({
        type: 'error',
        title: 'Save Failed',
        message: err.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!categoryId) {
      toast({ type: 'warning', title: 'Missing Category', message: 'Please select a category.' });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Menu Item' : 'Create Menu Item'}
      description={item ? `Updating "${item.name}"` : 'Add an item to the cafe menu'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-2">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Item Name"
            placeholder="e.g. Biscoff Caramel Frappe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
        </div>

        {/* Dietary / Food Type & GST */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-caption font-semibold text-brand-ink-900 mb-1.5">
              Food Classification (FSSAI)
            </label>
            <div className="flex items-center gap-3">
              {(['veg', 'non_veg', 'egg'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFoodType(type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-card-sm border text-small font-medium transition-colors ${
                    foodType === type
                      ? 'border-brand-gold-500 bg-brand-cream-100 text-brand-green-950 font-semibold ring-1 ring-brand-gold-500'
                      : 'border-brand-cream-300 bg-white text-brand-ink-700 hover:bg-brand-cream-50'
                  }`}
                >
                  <FoodTypeIndicator type={type} size="md" />
                  <span className="capitalize">{type.replace('_', '-')}</span>
                </button>
              ))}
            </div>
          </div>

          <Select
            label="GST Rate"
            value={gstRate}
            onChange={(e) => setGstRate(e.target.value)}
            options={[
              { value: '0', label: '0% (Exempt)' },
              { value: '5', label: '5% (Standard Cafe)' },
              { value: '12', label: '12%' },
              { value: '18', label: '18%' },
            ]}
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-caption font-semibold text-brand-ink-900">
              Description (Max 300 chars)
            </label>
            <span className="text-[11px] text-brand-ink-500">
              {description.length} / 300
            </span>
          </div>
          <Textarea
            placeholder="Tasting notes, preparation style, and ingredients..."
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 300))}
            rows={2}
          />
        </div>

        {/* PRICING & VARIANTS SECTION */}
        <div className="p-4 rounded-card-sm bg-brand-cream-50 border border-brand-cream-300 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-small font-semibold text-brand-green-950">
                Pricing & Portions (₹ INR)
              </h3>
              <p className="text-[11px] text-brand-ink-500">
                Stored in integer paise in database and converted for display.
              </p>
            </div>

            {!canEditPrice && item && (
              <Badge variant="warning" size="sm" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Price locked (Manager / Partner only)
              </Badge>
            )}
          </div>

          <Checkbox
            label="This item has size/portion variants (e.g. Regular, Large)"
            checked={hasVariants}
            disabled={!canEditPrice && !!item}
            onChange={(e) => setHasVariants(e.target.checked)}
          />

          {!hasVariants ? (
            <div className="max-w-xs">
              <Input
                label="Base Price (₹)"
                type="number"
                step="1"
                min="0"
                placeholder="150"
                value={basePriceRupees}
                disabled={!canEditPrice && !!item}
                onChange={(e) => setBasePriceRupees(e.target.value)}
                required={!hasVariants}
                helperText="Enter in Rupees (e.g., 150 = ₹150)"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {variants.map((v, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white p-2.5 rounded-card-sm border border-brand-cream-200">
                    <label className="flex items-center gap-1.5 text-caption cursor-pointer">
                      <input
                        type="radio"
                        name="default-variant"
                        checked={v.isDefault}
                        disabled={!canEditPrice && !!item}
                        onChange={() => handleSetDefaultVariant(index)}
                        className="text-brand-green-800 focus:ring-brand-gold-500"
                      />
                      <span className="font-semibold text-brand-ink-700">Default</span>
                    </label>

                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Variant Name (e.g., Large)"
                        value={v.name}
                        disabled={!canEditPrice && !!item}
                        onChange={(e) => {
                          const updated = [...variants];
                          if (updated[index]) {
                            updated[index] = { ...updated[index], name: e.target.value };
                            setVariants(updated);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-small border border-brand-cream-300 rounded focus:outline-none focus:border-brand-green-800"
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        placeholder="₹ Price"
                        value={v.priceRupees}
                        disabled={!canEditPrice && !!item}
                        onChange={(e) => {
                          const updated = [...variants];
                          if (updated[index]) {
                            updated[index] = { ...updated[index], priceRupees: e.target.value };
                            setVariants(updated);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-small border border-brand-cream-300 rounded focus:outline-none focus:border-brand-green-800"
                      />
                    </div>

                    {variants.length > 1 && canEditPrice && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(index)}
                        className="p-1 text-semantic-danger hover:bg-semantic-danger-bg rounded"
                        title="Remove variant"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canEditPrice && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={handleAddVariant}
                >
                  Add Another Size/Variant
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tags Selection */}
        <div>
          <label className="block text-caption font-semibold text-brand-ink-900 mb-1.5">
            Badges & Highlights
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => handleTagToggle(tag.value)}
                  className={`px-3 py-1 text-caption font-medium rounded-pill border transition-colors ${
                    isSelected
                      ? 'bg-brand-green-800 text-brand-cream-100 border-brand-green-800'
                      : 'bg-white text-brand-ink-700 border-brand-cream-300 hover:bg-brand-cream-100'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Photo Upload & Preview */}
        <div>
          <label className="block text-caption font-semibold text-brand-ink-900 mb-1.5">
            Item Photography (Auto-processed to WebP, Max 5MB)
          </label>
          <div className="flex items-center gap-4">
            {imagePreview ? (
              <div className="relative h-20 w-20 rounded-card-sm border border-brand-cream-300 overflow-hidden bg-brand-cream-100 shrink-0">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setRemoveExistingImage(true);
                  }}
                  className="absolute top-1 right-1 p-1 bg-white/90 text-semantic-danger rounded-full hover:bg-white shadow"
                  title="Remove image"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-card-sm border border-dashed border-brand-cream-300 flex items-center justify-center bg-brand-cream-50 text-brand-ink-400 shrink-0">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}

            <div className="flex-1">
              <input
                type="file"
                id="menu-item-image-input"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
              <label htmlFor="menu-item-image-input">
                <span className="inline-flex items-center gap-2 px-3 py-2 border border-brand-cream-300 rounded-card-sm text-small font-medium text-brand-ink-700 hover:bg-brand-cream-100 cursor-pointer transition-colors">
                  <Upload className="h-4 w-4" />
                  {imagePreview ? 'Change Photo' : 'Upload Photo'}
                </span>
              </label>
              <p className="text-[11px] text-brand-ink-500 mt-1">
                JPEG, PNG, or WebP. Auto-rotated and compressed to 1200px full & 400px thumbnail.
              </p>
            </div>
          </div>
        </div>

        {/* Ordering & Preparation Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Est. Preparation Time (Minutes)"
            type="number"
            min="0"
            placeholder="e.g. 5"
            value={preparationMinutes}
            onChange={(e) => setPreparationMinutes(e.target.value)}
          />

          <Input
            label="Sort Order"
            type="number"
            placeholder="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>

        {/* Feature toggles */}
        <div className="flex flex-wrap gap-6 pt-2">
          <Checkbox
            label="Mark as Featured Item"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
          {!item && (
            <Checkbox
              label="Currently In Stock / Available"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
            />
          )}
        </div>

        {/* Modal Actions */}
        <div className="sticky bottom-0 bg-brand-cream-50 pt-4 pb-1 border-t border-brand-cream-300 flex justify-end gap-3 z-20 mt-4 shadow-[0_-6px_12px_-4px_rgba(0,0,0,0.06)]">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={saveMutation.isPending}>
            {item ? 'Save Changes' : 'Create Menu Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
