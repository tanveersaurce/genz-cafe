import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { useToast } from '@/components/ui/Toast';

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  itemCount?: number;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: CategoryData | null;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  category,
}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setDescription(category.description || '');
      setSortOrder(category.sortOrder.toString());
      setIsActive(category.isActive);
    } else {
      setName('');
      setDescription('');
      setSortOrder('0');
      setIsActive(true);
    }
  }, [category, isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || undefined,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive,
      };

      if (category) {
        return apiClient.patch<{ success: boolean; data: CategoryData }>(
          `/menu/categories/${category.id}`,
          payload
        );
      } else {
        return apiClient.post<{ success: boolean; data: CategoryData }>(
          '/menu/categories',
          payload
        );
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      toast({
        type: 'success',
        title: category ? 'Category Updated' : 'Category Created',
        message: `"${res.data.name}" was successfully saved.`,
      });
      onClose();
    },
    onError: (err: Error) => {
      toast({
        type: 'error',
        title: 'Error Saving Category',
        message: err.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? 'Edit Menu Category' : 'Create Menu Category'}
      description={category ? `Editing "${category.name}"` : 'Add a new group for menu items'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Input
          label="Category Name"
          placeholder="e.g. Hot Brews, Finger Food"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description (Optional)"
          placeholder="Short description displayed on public menu..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <Input
          label="Sort Order"
          type="number"
          placeholder="0"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />

        <Checkbox
          label="Category is Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-brand-cream-300">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={mutation.isPending}>
            {category ? 'Save Changes' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
