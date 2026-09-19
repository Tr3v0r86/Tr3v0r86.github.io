import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'*.spec.mjs',fullyParallel:true,workers:3,retries:0,reporter:'list',use:{baseURL:'http://127.0.0.1:4173',headless:true},webServer:{command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},outputDir:'test-results'});
