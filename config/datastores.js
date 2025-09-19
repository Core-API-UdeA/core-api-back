module.exports.datastores = {
  default: {
    adapter: 'sails-postgresql',
    url: process.env.DATABASE_URL || 'postgresql://postgres.jhklyfyioaatabjygdkd:Z9E7xMd-ixHw8UH@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require',
    timezone: '+0'
  },
  CoreApiDB: {
    adapter: 'sails-postgresql',
    url: process.env.DATABASE_URL || 'postgresql://postgres.jhklyfyioaatabjygdkd:Z9E7xMd-ixHw8UH@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require',
    timezone: '+0'
  },
};
