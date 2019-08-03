# cache-crawled-links-worker

A [Cloudflare Worker](https://workers.cloudflare.com) that proxies requests to an origin server, and pre-caches pages that the user might navigate to.

## Features

📈 Improves the user experience by pre-caching pages the user might navigate to in the Edge-serve closest to the user  
🚀 Ensures fast performance by issuing the cache-warmup requests only after the response to the client has completed  
💥 Avoids cache-invalidation bugs by keeping the origin server in-charge of what is safe to cache and for how long  
🚰 Adheres to performance best-practices by streaming the origin server's response rather than buffering it  
📝 Annotated code to make it easy to adapt for newcomers to the Worker platform  

## Getting started

1. Clone or download this project (it's not on NPM)
1. Install dependencies with `npm install`
2. Set the hostname of your origin server in the code
3. Follow the Workers "Configuring and Publishing" guide [here](https://workers.cloudflare.com/docs/quickstart/configuring-and-publishing/) (don't forget to add a `wrangler.toml` to your project)
