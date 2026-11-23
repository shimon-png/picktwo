import Script from "next/script";
import {
  SIGNUP_CONVERSION_COOKIE,
  X_PIXEL_ID,
  X_SIGNUP_EVENT_ID,
} from "@/lib/marketing";
import { SignupConversion } from "./SignupConversion";

/**
 * X (Twitter) pixel: base code on every page, plus the sign-up conversion event on the first page load after
 * sign-up finishes (the server sets SIGNUP_CONVERSION_COOKIE). The event runs in the same script right after the
 * base code, so `twq` always exists (it queues until X's script loads); the cookie is cleared so it fires once.
 */
export function XPixel() {
  if (!X_PIXEL_ID) return null;
  const pixel = JSON.stringify(X_PIXEL_ID);
  const event = JSON.stringify(X_SIGNUP_EVENT_ID);
  const cookie = JSON.stringify(SIGNUP_CONVERSION_COOKIE);
  return (
    <>
      <SignupConversion />
      <Script id="x-pixel" strategy="afterInteractive">
        {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
twq('config',${pixel});
(function(){try{var n=${cookie},m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));
if(!m)return;document.cookie=n+'=; Max-Age=0; path=/; SameSite=Lax';
twq('event',${event},{conversion_id:decodeURIComponent(m[1])});}catch(e){}})();`}
      </Script>
    </>
  );
}
