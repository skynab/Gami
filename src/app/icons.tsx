import type { ReactNode, SVGProps } from 'react';

function icon(paths: ReactNode) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const BackIcon = icon(<path d="M15 5l-7 7 7 7" />);
export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </>,
);
export const FirstIcon = icon(<path d="M6 5v14M18 6l-8 6 8 6z" />);
export const PrevIcon = icon(<path d="M15 6l-6 6 6 6" />);
export const NextIcon = icon(<path d="M9 6l6 6-6 6" />);
/** A fold's arrow, drawn as the guides draw it, solid halfway over and dashed the rest: play half a step. */
export const HalfStepIcon = icon(
  <>
    <path d="M4 18a8 8 0 0 1 8-8" />
    <path d="M9 7l3 3-3 3" />
    <path d="M12 10a8 8 0 0 1 8 8" strokeDasharray="1.6 2.8" />
    <path d="M2.5 18.5h3M18.5 18.5h3" />
  </>,
);
export const LockIcon = icon(
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);
export const ResetIcon = icon(
  <>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
  </>,
);
export const StudioIcon = icon(
  <>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </>,
);

/** A square sheet with one corner folded over: Gami's stand-in for "a model". */
export const PaperIcon = icon(
  <>
    <path d="M4 4l16 16H4z" fill="currentColor" fillOpacity=".22" stroke="none" />
    <path d="M4 4h16v16H4z" />
    <path d="M4 4l16 16" strokeDasharray="2.5 2.5" />
  </>,
);
export const GuidesIcon = icon(
  <>
    <path d="M4 20L20 4" strokeDasharray="3 3" />
    <path d="M6 9a7 7 0 0 1 9-3" />
    <path d="M15 3.5l.3 2.6-2.6.6" />
  </>,
);
export const KeyboardIcon = icon(
  <>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </>,
);
export const HeartIcon = icon(
  <path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />,
);
export const PauseIcon = icon(<path d="M8 5.5v13M16 5.5v13" />);
export const ReplayIcon = icon(
  <>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4h4" />
    <path d="M10.5 9.5v5l4-2.5z" />
  </>,
);
