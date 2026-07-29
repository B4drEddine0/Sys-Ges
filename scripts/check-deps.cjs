const pkg = require('../package.json');
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const needed = ['react-hook-form', 'zod', '@hookform/resolvers', 'date-fns', 'framer-motion'];
const missing = needed.filter(d => !allDeps[d]);
console.log('All dependencies:', Object.keys(allDeps).join(', '));
console.log('\nNeeded:', needed.join(', '));
console.log('Missing:', missing.length ? missing.join(', ') : 'NONE');
