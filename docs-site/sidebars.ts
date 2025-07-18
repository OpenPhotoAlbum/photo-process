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
    {
      type: 'category',
      label: '🚀 Getting Started',
      items: [
        'getting-started/intro',
        'getting-started/installation',
        'getting-started/roadmap',
      ],
    },
    {
      type: 'category',
      label: '📖 User Guide',
      items: [
        'user-guide/photo-management',
        'user-guide/face-recognition',
      ],
    },
    {
      type: 'category',
      label: '🔧 Configuration',
      items: [
        'configuration/index',
        'configuration/database',
      ],
    },
    {
      type: 'category',
      label: '👨‍💻 Development',
      items: [
        'development/setup',
        'development/mcp-integration',
        'development/bug-tracking',
      ],
    },
    {
      type: 'category',
      label: '🚀 Deployment',
      items: [
        'deployment/index',
      ],
    },
    {
      type: 'category',
      label: '📱 Mobile App',
      items: [
        'mobile-app/overview',
        'mobile-app/setup',
        'mobile-app/development',
        'mobile-app/features',
        'mobile-app/roadmap',
      ],
    },
    {
      type: 'category',
      label: '📊 Monitoring & Logs',
      items: [
        'monitoring/overview',
        'monitoring/kibana-queries',
      ],
    },
  ],

  // API Reference sidebar
  apiSidebar: [
    {
      type: 'category',
      label: '📚 API Reference',
      items: [
        'api/introduction',
        'api/media-static',
        'api/gallery',
        'api/search',
        'api/geolocation',
        'api/persons',
        'api/faces',
        'api/training',
      ],
    },
  ],
};

export default sidebars;
