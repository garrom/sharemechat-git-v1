// BlogLocaleContext.js
//
// Context React para que BlogArticleView publique el locale activo del
// artículo y sus alternates (otras versiones del mismo artículo en otros
// locales). El LocaleSwitcher del navbar lo consume para saber a qué URL
// navegar cuando el visitante cambia de idioma mientras lee un artículo.
//
// Forma del valor expuesto:
//   {
//     currentLocale: 'es' | 'en',
//     currentSlug:   'mi-slug-en-este-locale',
//     alternates:    [{ locale: 'en', slug: 'my-slug', url: 'https://.../blog/en/my-slug' }],
//   }
//
// Cuando el visitante NO está en un detalle de artículo (listados, home,
// etc.), el Context queda con valor null y el LocaleSwitcher cae al
// comportamiento default (toggle entre /blog/es y /blog/en).

import { createContext, useContext } from 'react';

export const BlogLocaleContext = createContext(null);

export const useBlogLocale = () => useContext(BlogLocaleContext);
