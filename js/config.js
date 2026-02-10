/**
 * Application Configuration
 * 
 * This file contains configuration settings for the Capacity Planner.
 * Environment-specific values should be set before deployment.
 */

const CONFIG = {
    // Supabase Configuration
    // Replace these with your actual Supabase project values
    SUPABASE_URL: 'YOUR_SUPABASE_URL',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',
    
    // Feature Flags
    USE_SUPABASE: false,  // Set to true to enable Supabase backend
    
    // Storage Configuration
    STORAGE_KEY: 'capacity-planner-data',
    MAX_HISTORY: 50,
    
    // App Version
    VERSION: '6.1'
};

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
