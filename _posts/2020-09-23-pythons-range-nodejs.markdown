---
layout: post
title:  "Implimenting Python range in typescript"
date:   2020-09-23 12:03:05 +0100
categories: nodejs
---

I like python is great for a few things one being ranges so here we add a range generator in TypesScript


```
export function* range(start: number, stop?: number, step: number = 1): Generator<number, any, undefined> {
  const cur = (stop === undefined) ? 0 : start;
  const max = (stop === undefined) ? start : stop;
  for (let i = cur; step < 0 ? i > max : i < max; i += step) yield i;
}
```


```
  for (const i of range(5)) {
    console.log(i);
  }
```

