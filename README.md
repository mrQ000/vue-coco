# VUE-COCO - COMPONENT COMPOSER for VUE

Lightweight converter for .vue into .mjs files
- wraps HTML and CSS into single JS file
- transpiles PUG and LESS

# Installation

```bash
npm install -g vue-coco
```

# SOURCE (.vue) files

Template to start with:

```vue
<template lang="pug">
  // wrap the component into a root div with unique class
  .abc-xyz 
    h1 {{value}}
    small
      slot
</template>

<script>
  import OtherComp from "...";
  
  export default {
    name: "AbcXyz",
    components: {     // register sub-components
      OtherComp
    },    
    props:{ 
      value:String
    }
  }
</script>

<style lang="less">
  @import "globals.less"; // resolve any global less constants/macros
  
  .abc-xyz {              // wrap style definitions into unique class (same as used with html code)
    h1 {
      color: steelblue;  
    }
  }
</style>
```

# USAGE of OUTPUT (.mjs) files

Javascript: import and install your component
```javascript
import AbcXyz from "AbcXyz.mjs"

// either register component globally..
Vue.component( 'abc-xyz', AbcXyz);

// ..or just inside a certain Vue component
new Vue({
  ...
  components:{ AbcXyz},
  ...
})
```

Use the component in your PUG/HTML code the same way as any other one:
```pug
  abc-xyz(value="My Header") Some description text as slot content
```

# INVOCATION

## AS COMMAND LINE TOOL
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

## INSTALLATION AS WEBSTORM WATCHER
1. Install watcher: File > Settings > Tools > File Watchers > Custom Watcher
2. Hide output (.mjs) files: Project tree > context menu > File nesting... > Add > .vue | .mjs
