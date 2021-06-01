---
layout: post
title:  "function Fuzz Buzz"
date:   2021-06-01 13:55:00 +0100
categories: nodejs
---

So i was reading an article about an interview where they wrote the solution with a NN. Which you can read [here](https://joelgrus.com/2016/05/23/fizz-buzz-in-tensorflow/).

I don't have time to look into if this can be done with brain.js so instead here is a function style solution


### Rules

So the rules of the game are simple, any number divisible by three is replaced by the word fizz and any number divisible by five by the word buzz. Numbers divisible by 15 become fizz buzz. To make it functional I am not allowed to use `if` and no for loops.


So as with most of the code I write I will be makign heavy use of `ramda`


### Code

So first we need to take an input, this will be `100` as we will be using the numbers 1 - 100 and as ranges are exclusive we will simply add 1 to the input so that it includes all the numbers as you would expect


```
import * as R from 'ramda';

const fizzBuzz = R.pipe(
  R.add(1),
  R.range(1),
)
```

so now we have a sinlge function `fizzBuzz` that we can drop any number into and get all the numbers upto and including it. Next on the list is to creat a function that will take a number `n` and return the correct string based on the rules above. I am not allowed to use ifs but likly ramda hs a perfect function called cond `[[(*… → Boolean),(*… → *)]] → (*… → *)`.

This function looks complicated but its rather simple, it takes an array of arrays where the first function should return true/false if it returns true then the second function is called example if the input number is over 80 return a message 'It is over 80' else 'it is not over 80'

```
const message = R.cond([
  [
    (n) => n > 80,
    () => 'It is over 80',
  ],
  [
    // this is put `default` like in a switch case
    () => true,
    () => 'it is not over 80'
  ]
]);

message(85) // 'It is over 80'
message(2) // 'it is not over 80'
```


so lets get adding it

```
const checkFizzBuzz = R.cond([
  [
    (n: number) => R.equals(0, n % 15),
    () => 'Fizz Buzz',
  ],
  [
    (n: number) => R.equals(0, n % 5),
    () => 'Buzz',
  ],
  [
    (n: number) => R.equals(0, n % 3),
    () => 'Fizz',
  ],
  [
    T,
    (n: number) => n,
  ],
]);
```

next to `loop` over each number and pass it to `checkFizzBuzz` for this we will use a `map` so lets update our pipe to map each number to the function

```
const fizzBuzz = R.pipe(
  R.add(1),
  R.range(1),
  R.map(checkFizzBuzz)
)
```

and we are done :)

```
import * as R from 'ramda';
const checkFizzBuzz = R.cond([
  [
    (n: number) => R.equals(0, n % 15),
    () => 'Fizz Buzz',
  ],
  [
    (n: number) => R.equals(0, n % 5),
    () => 'Buzz',
  ],
  [
    (n: number) => R.equals(0, n % 3),
    () => 'Fizz',
  ],
  [
    R.T,
    (n: number) => n,
  ],
]);
const fizzBuzz = R.pipe(
  R.add(1),
  R.range(1),
  R.map(checkFizzBuzz),
);

fizzBuzz(100)
```


### Results

```
[
  1,      2,      'Fizz',      4,      'Buzz', 'Fizz',
  7,      8,      'Fizz',      'Buzz', 11,     'Fizz',
  13,     14,     'Fizz Buzz', 16,     17,     'Fizz',
  19,     'Buzz', 'Fizz',      22,     23,     'Fizz',
  'Buzz', 26,     'Fizz',      28,     29,     'Fizz Buzz',
  31,     32,     'Fizz',      34,     'Buzz', 'Fizz',
  37,     38,     'Fizz',      'Buzz', 41,     'Fizz',
  43,     44,     'Fizz Buzz', 46,     47,     'Fizz',
  49,     'Buzz', 'Fizz',      52,     53,     'Fizz',
  'Buzz', 56,     'Fizz',      58,     59,     'Fizz Buzz',
  61,     62,     'Fizz',      64,     'Buzz', 'Fizz',
  67,     68,     'Fizz',      'Buzz', 71,     'Fizz',
  73,     74,     'Fizz Buzz', 76,     77,     'Fizz',
  79,     'Buzz', 'Fizz',      82,     83,     'Fizz',
  'Buzz', 86,     'Fizz',      88,     89,     'Fizz Buzz',
  91,     92,     'Fizz',      94,     'Buzz', 'Fizz',
  97,     98,     'Fizz',      'Buzz'
]
```


