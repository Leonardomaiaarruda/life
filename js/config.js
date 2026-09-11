window.CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyZzoAEi14K4ItWRW8tohjFh1e25OfHu33CENlIio0sQbvuu0E6SQzOZk5gbF6FhbPB/exec",
  APP_NAME: "MetaLife",
  DEMO_MODE: true,
  VERSION: "22.1.0",

  // Migração gradual para Supabase. O Apps Script continua sendo o backend principal
  // até você preencher os dados abaixo e ativar explicitamente.
  DATA_PROVIDER: "apps-script",
  SUPABASE_ENABLED: false,
  SUPABASE_URL: "",
  SUPABASE_PUBLISHABLE_KEY: ""
};
