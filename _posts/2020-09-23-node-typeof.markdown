---
layout: post
title:  "Nodes typeof sucks"
date:   2020-09-23 12:03:05 +0100
categories: nodejs
---

I am sure if you ever used typeof you will know how meh it can be, with deep rooted issues that mean it cannot be changed you are left with inconsistent results

```
Welcome to Node.js v14.12.0.
Type ".help" for more information.
# create a function
> const a = () => true
undefined
> typeof a
'function'
> typeof {}
'object'
> typeof []
'object'
> typeof true
'boolean'
> typeof Buffer.from([])
'object'
> 
```

but we can actually get real types from node you just need to know where to look and that place is prototypes, `Object.prototype.toString.call` 

```bash
> Object.prototype.toString.call(a)
'[object Function]'
> Object.prototype.toString.call({})
'[object Object]'
> Object.prototype.toString.call([])
'[object Array]'
> Object.prototype.toString.call(Buffer.from([]))
'[object Uint8Array]'
```

we can then abstract this in to a function

```js
export function typeOf(value: any) {
  return Object.prototype.toString.call(value).split(' ')[1].slice(0, -1).toLowerCase();
}
```

```bash
> typeOf({})
'object'
> typeOf([])
'array'
> typeOf(() => true)
'function'
> typeOf(Buffer.from([]))
'uint8array'
```