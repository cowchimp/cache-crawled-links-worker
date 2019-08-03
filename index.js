import htmlparser from 'htmlparser2';

const ORIGIN_HOSTNAME = 'example.com';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  try {
    /* Create a url with the same protocol and path as the one from the request
     * but change the hostname to that of the origin server */
    const url = new URL(event.request.url);
    url.hostname = ORIGIN_HOSTNAME;
    /* Make a request to the origin server
     * notice this only `awaits` until the response status and headers are available,
     * and not until that the entire response payload has been downloaded */
    const originResponse = await fetchWithCache(url);

    /* If the response is not an HTML document, we have no need to do anything else
     * so we return the original response (acting as a simple proxy server) */
    const contentType = originResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      return originResponse;
    }

    /* If it is an HTML document then our goal is to pass the HTML content to the client
     * _and_ also to parse the HTML in order to find the links to other pages,
     * but we want to do this _without_ waiting for the entire response in the Worker
     * To achieve that we're streaming the original response's body (which is a
     * ReadableStream) into a new WritableStream provided by `TransformStream`,
     * which is then read as a new ReadableStream that is passed as the Worker's response */
    const { readable, writable } = new TransformStream();
    const streamPromise = streamResponse(originResponse.body, writable);
    /* The `originResponse` is passed as the 2nd parameter (`ResponseInit`)
     * in order to preserve the HTTP status and response headers */
    const response = new Response(readable, originResponse);

    /* `event.waitUntil` lets us register a promise that must complete before the Worker
     * will stop running, but without affecting\blocking the response to the client
     * In this case we're using it to cache the links we've found */
    event.waitUntil(
      streamPromise.then(crawledLinks =>
        cacheCrawledLinks(crawledLinks, url.origin),
      ),
    );

    return response;
  } catch (err) {
    const errMessage = err && err.message ? err.message : 'Oh no!';
    return new Response(errMessage, { status: 500 });
  }

  async function fetchWithCache(url) {
    /* This function makes a regular request with `fetch` but it instructs
     * Cloudflare to cache the response in the Edge Server using the `cf` property */
    const newRequestInit = {
      /* using `cacheEverything:true` instructs Cloudflare to cache the response HTML only
       * if the response has the appropriate HTTP caching headers (e.g. `Cache-Control`)
       * Alternatively you can use `cacheTtl:120` to instruct CF to cache the response
       * regardless of its headers for 120 seconds (it's riskier so use with caution)
       * You can also set a unique `cacheKey` to avoid cases where the response generated
       * for one particular user is cached and served to all users */
      cf: { cacheEverything: true }, //{ cacheTtl: 120, cacheKey: 'unique-fingerprint' },
    };
    const newRequest = new Request(
      url,
      /* We're passing the original request to the `Request` constructor with a new
       * `ResponseInit` in order to preserve everything about the original client request */
      new Request(event.request, newRequestInit),
    );
    return await fetch(newRequest);
  }

  async function streamResponse(readable, writable) {
    const crawledLinks = [];

    const reader = readable.getReader();
    /* We need the decoder to convert Uint8Array -> string */
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const parser = new htmlparser.Parser(
      {
        /* Set up a callback to be executed whenever the HTML parser recognizes
         * that a HTML tag is opened */
        onopentag: (name, attribs) => {
          /* If the tag is an anchor tag with an `href` tag then it's a link
           * that we want to cache so we store it in the `crawledLinks` array */
          if (name === 'a' && attribs.href) {
            console.log(`found a link! ${attribs.href}`);
            crawledLinks.push(attribs.href);
          }
        },
      },
      {
        decodeEntities: true,
      },
    );
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    /* Execute a recursive function that will read each chunk from the origin response,
     * pass it to the HTML parser, and write it back to the Worker response stream */
    await processNextChunk();

    parser.end();
    await writer.close();
    console.log('done transforming the request');

    return crawledLinks;

    async function processNextChunk() {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      const decodedValue = decoder.decode(value);
      parser.write(decodedValue);

      const encodedValue = encoder.encode(decodedValue);
      await writer.write(encodedValue);
      await processNextChunk();
    }
  }

  async function cacheCrawledLinks(links, origin) {
    await Promise.all(
      links.map(async link => {
        /* The links are relative URLs so we pass the `origin` (protocol+host)
         * to convert them to absolute URLs */
        const url = new URL(link, origin);
        console.log(`fetching ${url}`);
        await fetchWithCache(url);
      }),
    );
    console.log('done fetching all links');
  }
}
