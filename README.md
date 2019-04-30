# VUE-COCO - COMPONENT COMPOSER for VUE

Lightweight component composer for Vue
lightweight converter for .vue into .mjs files
- transpiles pug and less
- wraps html and css into js code
- injects Vue.component(...) global installation code

# Installation

```bash
npm install -g vue-coco
```

# USAGE of OUTPUT (.mjs) files

Javascript: globally install vue component just by importing it
```javascript
import {} from "AbcXyz.mjs"
```

HTML (or PUG): use the component as any other one 
```html
<abc-xyz myprop="123">slot content</abc-xyz>
```

# INVOCATION
Show help
```bash
vue-coco help
```
Immeditaley process a single .vue file
```bash
vue-coco <filename>.vue
```
Start watcher for "<path>/**/*.vue"
```bash
vue-coco <path> --watch
```

# Installation in webstorm
1. File > Settings > Tools > File Watchers > Custom Watcher
1. Project tree > context menu > File nesting... > Add > .vue | .mjs
