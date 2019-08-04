# cache-crawled-links-worker

A [Cloudflare Worker](https://workers.cloudflare.com) that proxies requests to an origin server, and pre-caches pages that the user might navigate to.

## Features

📈 Improves the user experience by pre-caching pages the user might navigate to in the Edge-serve closest to the user  
🚀 Ensures fast performance by issuing the cache-warmup requests only after the response to the client has completed  
💥 Avoids cache-invalidation bugs by keeping the origin server in-charge of what is safe to cache and for how long  
🚰 Adheres to performance best-practices by streaming the origin server's response rather than buffering it  
📝 Annotated code to make it easy to adapt for newcomers to the Worker platform  

## How it works

The Worker acts as a standard reverse-proxy server and streams the response from the origin server to the client.  
If it identifies that the response is an HTML document then as it streams the response it also parses the HTML and collects the urls from all the `href` attributes of all anchor tags.  
Then after the Worker finishes responding to the client it fetches all those urls with the necessary directive that instructs Cloudflare to cache the resource for future requests.

## Getting started

1. Clone or download this project (it's not on NPM)
1. Install dependencies with `npm install`
2. Set the hostname of your origin server in the code
3. Follow the Workers "Configuring and Publishing" guide [here](https://workers.cloudflare.com/docs/quickstart/configuring-and-publishing/) (don't forget to add a `wrangler.toml` to your project)

## Demo

⬅️ Worker proxy on the left  
Origin server on the right ➡️

You can see that initially the homepage request is slow on both sites.  
But the internal "cat" page is fast when accessed through the Worker because it was identified and eagerly cached in the Edge-server.

![Demo](/cache-crawled-links-worker-min.gif)
