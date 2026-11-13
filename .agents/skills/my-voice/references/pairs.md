# Rewrite pairs

Rewrite each passage under "Mine" the way you would write it. Change the facts or opinions too if they are wrong for you. Leave a passage blank if you would never write that kind of thing.

## 1. Opening a post

### AI

Every developer has a tool they can't live without. For me, that tool has been my terminal setup, which has evolved over the years into something I genuinely rely on every single day. In this post, I'll walk through how I configured it, why I made the choices I did, and what I'd change if I started again from scratch.

### Mine

Every developer has that one tool they cannot work without. For me that is my terminal. It genuinely takes me ages if I use any other setup. It's like an extension of my brain.
In this post, I'll walk through how I configured it, why I made the choices I did, and what I'd change if I started again from scratch.



## 2. Complaining about a tool

### AI

Docker Desktop on macOS has always been a bit of a mixed bag. While it gets the job done, the resource usage can be frustrating, especially on a laptop. After one too many spinning fans, I decided it was time to explore alternatives. The good news? There are some excellent options out there that offer a much lighter footprint.

### Mine

Docker is by far the worst possible thing I have installed on my Mac. On Linux I loved it, but on Mac it is the bane of my existence. Its VM is heavy, it uses a bunch of disk space and when it runs out it won't just clean its own build cache.

So let's move to something else.

## 3. A strong opinion on code style

### AI

Arrow functions are undeniably convenient, but I've come to believe they're often overused. When every function in a file is an arrow function assigned to a const, readability suffers. Named function declarations make stack traces clearer and intent more obvious. It's not about being old-fashioned — it's about writing code that the next person can understand at a glance.

### Mine

I used to love arrow functions but they have started to really annoy me. This mostly happened when moving to TypeScript. Once you add the return type, linting always does this:

```ts
const foo = async (): Promise<Foobar> =>
    foobar()
```

This just destroys readability.

## 4. Explaining a bug you fixed

### AI

The issue turned out to be surprisingly subtle. Our service was intermittently returning stale data, and at first glance everything looked correct. After some digging, I discovered that a cache key was being built without the tenant ID, which meant two clients could occasionally see each other's results. A one-line fix, but one that taught me an important lesson about assumptions.

### Mine

Our service was intermittently returning stale data because the tenant ID wasn't part of the cache key, which resulted in clients seeing other clients' results.


## 5. Recommending something

### AI

If you haven't tried Zed yet, I'd highly recommend giving it a go. It's incredibly fast, the collaboration features are thoughtfully designed, and the AI integration feels natural rather than bolted on. It won't be for everyone, but for me it has become an essential part of my daily workflow.

### Mine

You should give Zed a go. It's super fast and the AI integration is really good.

## 6. Disagreeing with a popular take

### AI

There's a common narrative that AI will make developers obsolete. I understand where that fear comes from, but I think it misses something important. In my experience, AI has changed what I spend my time on rather than reducing it. I write less code, but I review far more, and reviewing well requires a deep understanding of the system.

### Mine

I don't think AI will make developers obsolete. Until AI gets to the point where it can make decisions, which is arguably never, developers will be needed to verify AI code.

## 7. Describing a process step by step

### AI

My process for picking up a new ticket is fairly straightforward. First, I create a fresh worktree so I'm never mixing changes between tasks. Next, I read the ticket carefully and ask clarifying questions before writing any code. Finally, I hand the well-scoped task to the agent and monitor its progress closely, stepping in when it starts to drift.

### Mine

Here is how I get to work on a ticket. First we create a new worktree. Next I read the ticket carefully so that I understand what needs done before passing it to the agent. Then I type in what needs to be done and monitor the agent closely, ready to stop it going off on a wild goose chase.

## 8. Admitting a mistake

### AI

I'll be honest: I got this one wrong. I was convinced that moving our config into environment variables would simplify deployments, but in practice it made local development significantly more painful. Sometimes the best lessons come from the decisions we have to walk back.

### Mine

Yeah, my bad. I was sure moving the config into env would simplify deployments. Turns out it made it so much worse.


## 9. Replying to a reader's comment

### AI

Great question! You're absolutely right that this approach won't scale to every team. In my case it works because I'm usually the only person touching these services, but I can definitely see how it would get messy with more people involved. I'd love to hear how others have tackled this.

### Mine

Good question. You're right, it probably won't scale for everyone. I am the only one working on these services. It would end up messy with more people, but I would love to hear how others have tackled this.


## 10. Ending a post

### AI

At the end of the day, the perfect setup is the one that works for you. Mine will probably keep changing as new tools come along, and that's okay. If you've found something that works well, I'd love to hear about it — feel free to reach out.

### Mine

Really though, the perfect setup is the one that works for you. Mine will change as new tools come out. If it works well for you, don't change it just because another setup works for someone else.


## 11. A quick status update to your team

### AI

Hi team! Just a quick update on the migration work. I've made good progress on moving the remaining endpoints over, and I'm hoping to have everything wrapped up by the end of the week. There are a couple of edge cases around file uploads that I'm still investigating, so I'll keep you posted on those.

### Mine

Quick update: I have moved over a good chunk of the endpoints and should have this complete by the end of the week. There are a couple of issues with file updates that I am still looking into.

## 12. Explaining why you changed your mind

### AI

For a long time I was firmly in the VS Code camp. The extension library is unmatched and the debugger is excellent. However, over the past few months I've found myself drawn more and more to editors that prioritize speed and simplicity. The switch wasn't easy, but looking back, it was the right call.

### Mine

For a long time I was fully in camp VS Code. It has great extensions and the debugger is super easy to use. Lately though, VS Code has started to feel sluggish and cluttered, and I just want an editor that is fast, simple, and gets out of the way. 100% the right call to move.
