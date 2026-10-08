import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { User } from '../modules/auth/models/User';
import { authService } from '../modules/auth/auth.service';
import { auditService } from '../modules/audit/audit.service';
import { logger } from '../utils/logger';

export const seedPartner = async (): Promise<void> => {
  await connectDB();

  try {
    const existingPartner = await User.findOne({ role: 'partner' });

    if (existingPartner) {
      logger.info(
        `A partner account already exists ('${existingPartner.username}'). Skipping seeding (idempotent).`
      );
      return;
    }

    logger.info(`No partner found. Seeding initial partner '${env.SEED_PARTNER_USERNAME}'...`);

    const passwordHash = await authService.hashPassword(env.SEED_PARTNER_PASSWORD);

    const partner = await User.create({
      name: env.SEED_PARTNER_NAME,
      username: env.SEED_PARTNER_USERNAME.toLowerCase(),
      passwordHash,
      role: 'partner',
      isActive: true,
      mustChangePassword: false,
    });

    await auditService.log({
      actorId: partner._id,
      actorName: partner.name,
      action: 'user.seed_partner',
      entityType: 'User',
      entityId: partner._id.toString(),
      metadata: { username: partner.username },
    });

    logger.info(`✅ Successfully seeded initial partner account: '${partner.username}'`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed partner account');
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

if (require.main === module) {
  seedPartner()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
