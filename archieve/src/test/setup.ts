import { JSDOM } from 'jsdom';

const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost',
});

// @ts-expect-error -- assign jsdom window to global for test environment
global.window = jsdom.window;
// @ts-expect-error -- assign jsdom document to global for test environment
global.document = jsdom.window.document;
// @ts-expect-error -- assign jsdom navigator to global for test environment
global.navigator = jsdom.window.navigator;
// @ts-expect-error -- assign jsdom Node to global for test environment
global.Node = jsdom.window.Node;
// @ts-expect-error -- assign jsdom HTMLElement to global for test environment
global.HTMLElement = jsdom.window.HTMLElement;
// @ts-expect-error -- assign jsdom HTMLDivElement to global for test environment
global.HTMLDivElement = jsdom.window.HTMLDivElement;
// @ts-expect-error -- assign jsdom HTMLAnchorElement to global for test environment
global.HTMLAnchorElement = jsdom.window.HTMLAnchorElement;
// @ts-expect-error -- assign jsdom self to global for test environment
global.self = global.window;

// Necessary for TanStack Query
// @ts-expect-error -- assign jsdom Request to global for test environment
global.Request = jsdom.window.Request;
// @ts-expect-error -- assign jsdom Response to global for test environment
global.Response = jsdom.window.Response;
// @ts-expect-error -- assign jsdom Headers to global for test environment
global.Headers = jsdom.window.Headers;

// Enable React act() environment
// @ts-expect-error -- React act() environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// @ts-expect-error -- React act() environment flag
global.IS_REACT_ACT_ENVIRONMENT = true;
