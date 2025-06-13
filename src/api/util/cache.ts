import { Logger } from '../logger';

const logger = Logger.getInstance();

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class InMemoryCache {
    private cache = new Map<string, CacheEntry<any>>();
    private maxSize = 1000; // Maximum number of cache entries
    
    set<T>(key: string, data: T, ttlSeconds = 300): void {
        // If cache is at max size, remove oldest entries
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlSeconds * 1000
        });
        
        logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    }
    
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        
        if (!entry) {
            logger.debug(`Cache MISS: ${key}`);
            return null;
        }
        
        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            logger.debug(`Cache EXPIRED: ${key}`);
            return null;
        }
        
        logger.debug(`Cache HIT: ${key}`);
        return entry.data;
    }
    
    delete(key: string): void {
        this.cache.delete(key);
        logger.debug(`Cache DELETE: ${key}`);
    }
    
    clear(): void {
        this.cache.clear();
        logger.debug('Cache CLEARED');
    }
    
    // Invalidate entries by pattern
    invalidatePattern(pattern: string): void {
        const regex = new RegExp(pattern);
        const keysToDelete: string[] = [];
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
        logger.debug(`Cache INVALIDATED pattern: ${pattern} (${keysToDelete.length} keys)`);
    }
    
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize
        };
    }
}

export const cache = new InMemoryCache();

// Invalidate gallery cache when images are added/updated
export function invalidateGalleryCache(): void {
    cache.invalidatePattern('^gallery:');
    logger.debug('Gallery cache invalidated');
}

// Cache utility functions
export function getCacheKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}:${params[key]}`)
        .join('|');
    return `${prefix}:${sortedParams}`;
}

// Decorator for caching function results
export function cached(ttlSeconds = 300) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
            const cacheKey = getCacheKey(`${target.constructor.name}.${propertyName}`, {
                args: JSON.stringify(args)
            });
            
            const cachedResult = cache.get(cacheKey);
            if (cachedResult !== null) {
                return cachedResult;
            }
            
            const result = await method.apply(this, args);
            cache.set(cacheKey, result, ttlSeconds);
            return result;
        };
        
        return descriptor;
    };
}