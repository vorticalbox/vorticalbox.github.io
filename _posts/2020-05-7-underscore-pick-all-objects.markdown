---
layout: post
title:  "Implimenting underscores .pick to all objects"
date:   2020-05-7 12:03:05 +0100
categories: nodejs
---

Been a while since I updated so I though I'll post.

At work I saw quite a few projects importing underscore to use it's .pick function

```
_.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
```

I like trying to impliment these sorts of things in pure nodejs.

```js
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

You can then use .pick on any object

```js
const person = {name: 'moe', age: 50, userid: 'moe1'};
person.pick(['name']);
```
