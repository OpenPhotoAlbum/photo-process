import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Main documentation sidebar
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'configuration/index',
        'configuration/database',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      items: [
        'development/setup',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        'deployment/index',
      ],
    },
  ],

  // API Reference sidebar
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/overview',
      ],
    },
  ],
};

export default sidebars;
