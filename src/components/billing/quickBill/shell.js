/*
  Where the flow sits.

  It used to be `fixed inset-0`, and `inset-0` on a fixed element means the
  VIEWPORT. That covered the whole window, app chrome included: on desktop an
  opaque backdrop sat over the sidebar, so pressing Invoice on the dashboard
  left every nav item visible-but-dead and this screen's Back button the only
  exit. On a phone the same edge-to-edge box reached under the bottom tab bar,
  which paints above this flow, hiding the Continue / Send button behind it.

  Still fixed -- the step slider below needs a viewport-stable box, not a
  scrolling one -- but inset off the chrome instead of over it. The two
  variables are published by Layout, which is the only thing that knows the
  current sidebar width and the measured tab-bar height. They default to 0 so
  the flow still fills the window if it is ever rendered outside the app shell.
*/
export const SHELL_POSITION =
  "fixed top-0 right-0 left-0 bottom-[var(--app-bottom-nav-height,0px)] " +
  "lg:bottom-0 lg:left-[var(--app-sidebar-width,0px)] " +
  "transition-[left,bottom] duration-300";
