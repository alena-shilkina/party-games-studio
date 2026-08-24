// dist/app.html подключается как текстовый модуль (см. [[rules]] в wrangler.toml)
declare module '*.html' {
  const content: string;
  export default content;
}
