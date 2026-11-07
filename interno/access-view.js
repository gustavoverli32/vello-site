// Keep the entry form hidden until the server-backed session check has finished.
export function setAccessView(signedIn){
  document.body.dataset.access=signedIn?'authenticated':'anonymous';
  document.querySelector('#session-loading').hidden=true;
  document.querySelector('#auth').hidden=signedIn;
  document.querySelector('#workspace').hidden=!signedIn;
  document.querySelector('#logout').hidden=!signedIn;
}
