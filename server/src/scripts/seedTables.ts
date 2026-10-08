import mongoose from 'mongoose';
import { env } from '../config/env';
import { Table, TableZone } from '../modules/tables/table.model';
import { logger } from '../utils/logger';

interface SeedTableDefinition {
  number: number;
  label: string;
  capacity: number;
  zone: TableZone;
  isReservable: boolean;
  sortOrder: number;
  notes?: string;
}

const sampleTables: SeedTableDefinition[] = [
  // 6 x 2-Seaters
  { number: 1, label: 'Window Cozy 1', capacity: 2, zone: 'window', isReservable: true, sortOrder: 1 },
  { number: 2, label: 'Window Cozy 2', capacity: 2, zone: 'window', isReservable: true, sortOrder: 2 },
  { number: 3, label: 'Indoor Booth 1', capacity: 2, zone: 'indoor', isReservable: true, sortOrder: 3 },
  { number: 4, label: 'Indoor Booth 2', capacity: 2, zone: 'indoor', isReservable: true, sortOrder: 4 },
  { number: 5, label: 'Patio Bistro 1 (Walk-in)', capacity: 2, zone: 'outdoor', isReservable: false, sortOrder: 5, notes: 'Reserved for street walk-ins' },
  { number: 6, label: 'Patio Bistro 2 (Walk-in)', capacity: 2, zone: 'outdoor', isReservable: false, sortOrder: 6, notes: 'Reserved for street walk-ins' },

  // 6 x 4-Seaters
  { number: 7, label: 'Main Hall 1', capacity: 4, zone: 'indoor', isReservable: true, sortOrder: 7 },
  { number: 8, label: 'Main Hall 2', capacity: 4, zone: 'indoor', isReservable: true, sortOrder: 8 },
  { number: 9, label: 'Window View 3', capacity: 4, zone: 'window', isReservable: true, sortOrder: 9 },
  { number: 10, label: 'Window View 4', capacity: 4, zone: 'window', isReservable: true, sortOrder: 10 },
  { number: 11, label: 'Outdoor Garden 1 (Walk-in)', capacity: 4, zone: 'outdoor', isReservable: false, sortOrder: 11, notes: 'Open terrace walk-in table' },
  { number: 12, label: 'Outdoor Garden 2 (Walk-in)', capacity: 4, zone: 'outdoor', isReservable: false, sortOrder: 12, notes: 'Open terrace walk-in table' },

  // 2 x 6-Seaters
  { number: 13, label: 'Family Alcove 1', capacity: 6, zone: 'family', isReservable: true, sortOrder: 13 },
  { number: 14, label: 'Family Alcove 2', capacity: 6, zone: 'family', isReservable: true, sortOrder: 14 },

  // 1 x 8-Seater
  { number: 15, label: 'Community Feast Table', capacity: 8, zone: 'indoor', isReservable: true, sortOrder: 15, notes: 'Large group & team table' },
];

export async function seedTables(): Promise<void> {
  logger.info('Starting sample tables seeding...');

  let createdCount = 0;
  let updatedCount = 0;

  for (const t of sampleTables) {
    const existing = await Table.findOne({ number: t.number });
    if (!existing) {
      await Table.create({ ...t, isActive: true });
      createdCount++;
    } else {
      existing.label = t.label;
      existing.capacity = t.capacity;
      existing.zone = t.zone;
      existing.isReservable = t.isReservable;
      existing.sortOrder = t.sortOrder;
      existing.notes = t.notes;
      await existing.save();
      updatedCount++;
    }
  }

  logger.info(
    { total: sampleTables.length, created: createdCount, updated: updatedCount },
    'Sample tables seeding completed successfully.'
  );
}

// Direct CLI invocation
if (require.main === module) {
  mongoose
    .connect(env.MONGO_URI)
    .then(async () => {
      await seedTables();
      await mongoose.disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to seed sample tables');
      process.exit(1);
    });
}
