import { JSDOM } from 'jsdom';

const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost',
});

// @ts-ignore
global.window = jsdom.window;
// @ts-ignore
global.document = jsdom.window.document;
// @ts-ignore
global.navigator = jsdom.window.navigator;
// @ts-ignore
global.Node = jsdom.window.Node;
// @ts-ignore
global.HTMLElement = jsdom.window.HTMLElement;
// @ts-ignore
global.HTMLDivElement = jsdom.window.HTMLDivElement;
// @ts-ignore
global.HTMLAnchorElement = jsdom.window.HTMLAnchorElement;
// @ts-ignore
global.self = global.window;

// Necessary for TanStack Query
// @ts-ignore
global.Request = jsdom.window.Request;
// @ts-ignore
global.Response = jsdom.window.Response;
// @ts-ignore
global.Headers = jsdom.window.Headers;

// Enable React act() environment
// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// @ts-ignore
global.IS_REACT_ACT_ENVIRONMENT = true;
