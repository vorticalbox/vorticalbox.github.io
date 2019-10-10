---
layout: post
title: snippets
---

add lodash's .pick to all javascript objects

```javascript
Object.defineProperty(Object.prototype, 'pick', {
  value: function(keys = []) {
    if(!Array.isArray(keys)) return  new Error('Must pass an array')
    return keys.reduce((acc, key) =>{
      if(this[key]) acc[key] = this[key]
      return acc
    }, {})
  }
});
```