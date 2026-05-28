function handler(event) {
  var request = event.request;
  var host = (request.headers && request.headers.host && request.headers.host.value) ? request.headers.host.value : "";

  if (host === "www.sharemechat.com") {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://sharemechat.com" + request.uri }
      }
    };
  }

  return request;
}
