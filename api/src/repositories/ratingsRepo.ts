/**
 * Repository for product rating data access
 */

import { getDatabase, DatabaseConnection } from '../db/sqlite';
import {
  ConflictError,
  handleDatabaseError,
  NotFoundError,
  ValidationError,
} from '../utils/errors';
import {
  CreateRatingInput,
  Rating,
  RatingSummary,
  UpdateRatingInput,
} from '../models/rating';
import { DatabaseRow, mapDatabaseRows, objectToCamelCase } from '../utils/sql';

interface RatingSummaryRow {
  average_score: number | null;
  rating_count: number;
}

export class RatingsRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  private validateScore(score: number): void {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new ValidationError('Score must be an integer between 1 and 5');
    }
  }

  private validateOwnershipToken(ownershipToken: string): void {
    if (
      typeof ownershipToken !== 'string' ||
      ownershipToken.length < 16 ||
      ownershipToken.length > 255
    ) {
      throw new ValidationError('Ownership token must be between 16 and 255 characters');
    }
  }

  private async findById(id: number): Promise<Rating | null> {
    const row = await this.db.get<DatabaseRow>(
      'SELECT rating_id, product_id, score, created_at, updated_at FROM ratings WHERE rating_id = ?',
      [id],
    );
    return row ? objectToCamelCase<Rating>(row) : null;
  }

  async productExists(productId: number): Promise<boolean> {
    try {
      const row = await this.db.get<{ product_id: number }>(
        'SELECT product_id FROM products WHERE product_id = ?',
        [productId],
      );
      return Boolean(row);
    } catch (error) {
      handleDatabaseError(error, 'Product', productId);
    }
  }

  async findByProductId(productId: number): Promise<Rating[]> {
    try {
      const rows = await this.db.all<DatabaseRow>(
        `SELECT rating_id, product_id, score, created_at, updated_at
         FROM ratings
         WHERE product_id = ?
         ORDER BY rating_id`,
        [productId],
      );
      return mapDatabaseRows<Rating>(rows);
    } catch (error) {
      handleDatabaseError(error, 'Product', productId);
    }
  }

  async findSummaryByProductId(productId: number): Promise<RatingSummary> {
    try {
      const summary = await this.db.get<RatingSummaryRow>(
        `SELECT AVG(score) AS average_score, COUNT(*) AS rating_count
         FROM ratings
         WHERE product_id = ?`,
        [productId],
      );
      const distributionRows = await this.db.all<{ score: number; count: number }>(
        `SELECT score, COUNT(*) AS count
         FROM ratings
         WHERE product_id = ?
         GROUP BY score`,
        [productId],
      );
      const distribution: Record<string, number> = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      };
      for (const row of distributionRows) {
        distribution[String(row.score)] = row.count;
      }

      return {
        averageScore: summary?.average_score ?? 0,
        ratingCount: summary?.rating_count ?? 0,
        distribution,
      };
    } catch (error) {
      handleDatabaseError(error, 'Product', productId);
    }
  }

  async findOwnedByProductId(productId: number, ownershipToken: string): Promise<Rating | null> {
    try {
      this.validateOwnershipToken(ownershipToken);
      const row = await this.db.get<DatabaseRow>(
        `SELECT rating_id, product_id, score, created_at, updated_at
         FROM ratings
         WHERE product_id = ? AND ownership_token = ?`,
        [productId, ownershipToken],
      );
      return row ? objectToCamelCase<Rating>(row) : null;
    } catch (error) {
      handleDatabaseError(error, 'Product', productId);
    }
  }

  async create(input: CreateRatingInput): Promise<Rating> {
    try {
      this.validateScore(input.score);
      this.validateOwnershipToken(input.ownershipToken);

      const product = await this.db.get<{ product_id: number }>(
        'SELECT product_id FROM products WHERE product_id = ?',
        [input.productId],
      );
      if (!product) {
        throw new NotFoundError('Product', input.productId);
      }

      const result = await this.db.run(
        `INSERT INTO ratings (product_id, score, ownership_token)
         VALUES (?, ?, ?)`,
        [input.productId, input.score, input.ownershipToken],
      );
      const created = await this.findById(result.lastID || 0);
      if (!created) {
        throw new Error('Failed to retrieve created rating');
      }
      return created;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError('This browser already rated this product');
      }
      handleDatabaseError(error, 'Product', input.productId);
    }
  }

  async update(id: number, input: UpdateRatingInput): Promise<Rating> {
    try {
      this.validateScore(input.score);
      this.validateOwnershipToken(input.ownershipToken);

      const result = await this.db.run(
        `UPDATE ratings
         SET score = ?, updated_at = CURRENT_TIMESTAMP
         WHERE rating_id = ? AND ownership_token = ?`,
        [input.score, id, input.ownershipToken],
      );
      if (result.changes === 0) {
        const rating = await this.findById(id);
        if (!rating) {
          throw new NotFoundError('Rating', id);
        }
        throw new ConflictError('You do not own this rating');
      }

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated rating');
      }
      return updated;
    } catch (error) {
      handleDatabaseError(error, 'Rating', id);
    }
  }

  async delete(id: number, ownershipToken: string): Promise<void> {
    try {
      this.validateOwnershipToken(ownershipToken);

      const result = await this.db.run(
        'DELETE FROM ratings WHERE rating_id = ? AND ownership_token = ?',
        [id, ownershipToken],
      );
      if (result.changes === 0) {
        const rating = await this.findById(id);
        if (!rating) {
          throw new NotFoundError('Rating', id);
        }
        throw new ConflictError('You do not own this rating');
      }
    } catch (error) {
      handleDatabaseError(error, 'Rating', id);
    }
  }
}

export async function createRatingsRepository(isTest: boolean = false): Promise<RatingsRepository> {
  const db = await getDatabase(isTest);
  return new RatingsRepository(db);
}

let ratingsRepo: RatingsRepository | null = null;

export async function getRatingsRepository(isTest: boolean = false): Promise<RatingsRepository> {
  const isTestEnv = isTest || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  if (isTestEnv) {
    return createRatingsRepository(true);
  }
  if (!ratingsRepo) {
    ratingsRepo = await createRatingsRepository(false);
  }
  return ratingsRepo;
}
