import ReactMarkdown from 'react-markdown';
import React from 'react';
import { renderToString } from 'react-dom/server';

const content = `| Feature | Support |\n| --- | --- |\n| Table | Yes |`;

const html = renderToString(React.createElement(ReactMarkdown, null, content));
console.log('RENDERED HTML:');
console.log(html);
