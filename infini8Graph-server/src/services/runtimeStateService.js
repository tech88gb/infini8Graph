import supabase from '../config/database.js';

const RUNTIME_CACHE_TABLE = 'runtime_cache_entries';

export async function getRuntimeCache(cacheKey) {
    const { data, error } = await supabase
        .from(RUNTIME_CACHE_TABLE)
        .select('cache_value, expires_at')
        .eq('cache_key', cacheKey)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    if (data.expires_at && new Date(data.expires_at) <= new Date()) {
        await deleteRuntimeCache(cacheKey);
        return null;
    }

    return data.cache_value ?? null;
}

export async function setRuntimeCache(cacheKey, cacheValue, ttlSeconds) {
    const expiresAt = new Date(Date.now() + (ttlSeconds * 1000)).toISOString();

    const { error } = await supabase
        .from(RUNTIME_CACHE_TABLE)
        .upsert({
            cache_key: cacheKey,
            cache_value: cacheValue,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'cache_key'
        });

    if (error) {
        throw error;
    }

    return cacheValue;
}

export async function deleteRuntimeCache(cacheKey) {
    const { error } = await supabase
        .from(RUNTIME_CACHE_TABLE)
        .delete()
        .eq('cache_key', cacheKey);

    if (error) {
        throw error;
    }
}

export async function deleteRuntimeCacheByPrefix(prefix) {
    const { error } = await supabase
        .from(RUNTIME_CACHE_TABLE)
        .delete()
        .like('cache_key', `${prefix}%`);

    if (error) {
        throw error;
    }
}

export default {
    getRuntimeCache,
    setRuntimeCache,
    deleteRuntimeCache,
    deleteRuntimeCacheByPrefix,
};
