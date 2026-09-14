window.CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyZzoAEi14K4ItWRW8tohjFh1e25OfHu33CENlIio0sQbvuu0E6SQzOZk5gbF6FhbPB/exec",
  APP_NAME: "MetaLife",
  DEMO_MODE: true,
  VERSION: "22.1.2",

  // O Apps Script/Sheets continua sendo o backend oficial do MetaLife.
  // A preparação para Supabase fica preservada no repositório, mas fora do runtime
  // enquanto a migração estiver pausada.
  DATA_PROVIDER: "apps-script",
  SUPABASE_ENABLED: false,
  SUPABASE_URL: "",
  SUPABASE_PUBLISHABLE_KEY: ""
};
