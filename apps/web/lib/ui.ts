import { twMerge } from 'tailwind-merge';

// Reusable Tailwind utilities; data attributes preserve nested layout and state variants.
const utilities: Record<string, string> = {
  body: 'm-0 bg-[#f6f7f4] text-[#243e36] font-[family-name:Tahoma,_Arial,_sans-serif] text-[14px] leading-[1.8] [&_:where(button)]:cursor-pointer [&_:where(button)]:transition-[background,border-color,transform] [&_:where(button)]:duration-[160ms] [&_:where(button)]:ease-[ease] [&_:where(input)]:w-full [&_:where(input)]:border [&_:where(input)]:border-solid [&_:where(input)]:border-[#dce2db] [&_:where(input)]:bg-white [&_:where(input)]:rounded-[9px] [&_:where(input)]:p-[11px_13px] [&_:where(input)]:text-[#243e36] [&_:where(input)]:outline-none [&_:where(textarea)]:w-full [&_:where(textarea)]:border [&_:where(textarea)]:border-solid [&_:where(textarea)]:border-[#dce2db] [&_:where(textarea)]:bg-white [&_:where(textarea)]:rounded-[9px] [&_:where(textarea)]:p-[11px_13px] [&_:where(textarea)]:text-[#243e36] [&_:where(textarea)]:outline-none [&_:where(textarea)]:min-h-[95px] [&_:where(textarea)]:resize-y [&_:where(select)]:w-full [&_:where(select)]:border [&_:where(select)]:border-solid [&_:where(select)]:border-[#dce2db] [&_:where(select)]:bg-white [&_:where(select)]:rounded-[9px] [&_:where(select)]:p-[11px_13px] [&_:where(select)]:text-[#243e36] [&_:where(select)]:outline-none [&_:where(button:disabled)]:opacity-[0.5] [&_:where(button:disabled)]:cursor-not-allowed [&_:where(button:focus-visible)]:[outline:3px_solid_#9dc3a4] [&_:where(button:focus-visible)]:outline-offset-[3px] [&_:where(a:focus-visible)]:[outline:3px_solid_#9dc3a4] [&_:where(a:focus-visible)]:outline-offset-[3px] [&_:where(input:focus)]:border-[#5f8c73] [&_:where(input:focus)]:shadow-[0_0_0_3px_#edf4ee] [&_:where(textarea:focus)]:border-[#5f8c73] [&_:where(textarea:focus)]:shadow-[0_0_0_3px_#edf4ee] [&_:where(select:focus)]:border-[#5f8c73] [&_:where(select:focus)]:shadow-[0_0_0_3px_#edf4ee] [&_:where(label)]:flex [&_:where(label)]:flex-col [&_:where(label)]:gap-[7px] [&_:where(label)]:text-[12px] [&_:where(label)]:font-semibold [&_:where(h1)]:text-[27px] [&_:where(h1)]:tracking-[-0.7px] [&_:where(h1)]:leading-[1.6] [&_:where(h2)]:text-[18px] [&_:where(h3)]:text-[14px] [&_:where(small)]:text-[11px] [&_:where(small)]:font-normal [&_:where(svg)]:shrink-0 max-[900.01px]:[&_:where(h1)]:text-[23px] motion-reduce:[&_*]:transition-none! motion-reduce:[&_*]:animate-none!',
  primary:
    'inline-flex items-center justify-center gap-[9px] min-h-[43px] p-[9px_17px] rounded-[9px] text-[12px] font-semibold bg-[#255a46] text-white border border-solid border-[#255a46] [&:hover:not(:disabled)]:bg-[#184632]',
  secondary:
    'inline-flex items-center justify-center gap-[9px] min-h-[43px] p-[9px_17px] rounded-[9px] text-[12px] font-semibold bg-white border border-solid border-[#e5e9e2] text-[#4d6258] [&:hover:not(:disabled)]:bg-[#edf4ee] [&:hover:not(:disabled)]:border-[#c4d4c7]',
  'icon-button': 'p-[10px]',
  eyebrow:
    'text-[10px] tracking-[0.3px] text-[#7b8580] flex items-center gap-[6px] mb-[5px]',
  muted: 'text-[#7b8580] text-[12px]',
  brand:
    'flex items-center gap-[11px] [&_strong]:text-[26px] [&_strong]:block [&_strong]:leading-[1.3] [&_strong]:tracking-[-1px] [&_small]:block [&_small]:text-[8px] [&_small]:tracking-[2px] [&_small]:text-[#819086] [&_small]:leading-[1.8] max-[650.01px]:[&_strong]:text-[21px] max-[650.01px]:[&_small]:hidden',
  'brand-mark':
    'grid place-items-center w-[42px] h-[45px] bg-[#255a46] text-white font-[family-name:serif] text-[34px] leading-[1] rounded-[15px_5px_15px_5px] max-[650.01px]:w-[29px] max-[650.01px]:h-[33px] max-[650.01px]:text-[25px] max-[650.01px]:rounded-[10px_4px_10px_4px]',
  sidebar:
    'fixed right-0 top-0 bottom-0 w-[240px] border-l border-solid border-l-[#e5e9e2] bg-white p-[30px_22px] flex flex-col z-[20] [&>[data-ui~=brand]]:p-[0_10px] max-[1200.01px]:w-[215px] max-[1200.01px]:p-[25px_15px] max-[900.01px]:w-[180px] max-[900.01px]:p-[25px_10px] max-[900.01px]:[&>[data-ui~=brand]]:p-[0_12px] max-[650.01px]:sticky max-[650.01px]:top-0 max-[650.01px]:w-full max-[650.01px]:h-auto max-[650.01px]:flex-row max-[650.01px]:p-[9px_14px] max-[650.01px]:gap-[12px] max-[650.01px]:border-b max-[650.01px]:border-solid max-[650.01px]:border-b-[#e5e9e2] max-[650.01px]:items-center max-[650.01px]:[&>[data-ui~=brand]]:p-0 max-[650.01px]:[&>[data-ui~=brand]]:gap-[6px] max-[650.01px]:[&_nav]:flex max-[650.01px]:[&_nav]:items-center max-[650.01px]:[&_nav]:gap-[5px] max-[650.01px]:[&_nav]:mr-auto',
  'restaurant-switch':
    'flex items-center gap-[9px] m-[32px_0_28px] p-[13px_10px] bg-[#f7f8f5] border border-solid border-[#e8ece4] rounded-[11px] [&_strong]:text-[12px] [&_strong]:block [&_small]:block [&_small]:text-[10px] [&_small]:text-[#7b8580] max-[900.01px]:p-[10px_8px] max-[650.01px]:hidden',
  'restaurant-avatar':
    'w-[34px] h-[34px] grid place-items-center border border-solid border-[#d9e2d4] rounded-[9px] text-[20px] text-[#6f886b] bg-[#ebf0e4]',
  'switch-dots': 'mr-auto text-[10px] text-[#8e9991] max-[900.01px]:hidden',
  'nav-label':
    'text-[10px] text-[#929a95] p-[0_13px] mb-[13px] max-[650.01px]:hidden',
  'nav-item':
    'flex items-center gap-[12px] p-[12px_14px] w-full text-[12px] text-[#7d8981] rounded-[9px] mb-[7px] text-right [&[data-ui~=active]]:text-[#255a46] [&[data-ui~=active]]:bg-[#ecf3ed] [&[data-ui~=active]]:font-bold [&:hover]:bg-[#f5f7f3] [&[data-ui~=active]:hover]:bg-[#f5f7f3] [&_small]:mr-auto [&_small]:bg-[#dae8dc] [&_small]:rounded-[6px] [&_small]:min-w-[23px] [&_small]:text-center max-[900.01px]:p-[11px_12px] max-[900.01px]:gap-[9px] max-[900.01px]:text-[11px] max-[650.01px]:m-0 max-[650.01px]:p-[9px] max-[650.01px]:text-[9px] max-[650.01px]:gap-[5px] max-[650.01px]:whitespace-nowrap max-[650.01px]:[&_svg]:w-[16px] max-[650.01px]:[&_svg]:h-[16px] max-[650.01px]:[&_small]:hidden',
  'sidebar-bottom': 'mt-auto max-[650.01px]:hidden',
  'shift-note':
    'flex gap-[9px] bg-[#f7f8f4] p-[15px_11px] rounded-[10px] m-[20px_0] [&>i]:w-[6px] [&>i]:h-[6px] [&>i]:bg-[#7a9675] [&>i]:rounded-full [&>i]:mt-[8px] [&>i]:shrink-0 [&_strong]:text-[11px] [&_strong]:font-medium [&_p]:text-[10px] [&_p]:text-[#929b91] [&_p]:mt-[5px] [&_p]:leading-[2] max-[900.01px]:hidden',
  profile:
    'border-t border-solid border-t-[#e5e9e2] pt-[20px] flex items-center gap-[9px] [&_strong]:block [&_strong]:text-[11px] [&_small]:block [&_small]:text-[9px] [&_small]:text-[#7b8580] [&_button]:mr-auto [&_button]:p-[5px] [&_button]:text-[#8d998f]',
  'profile-avatar':
    'w-[33px] h-[33px] rounded-full grid place-items-center bg-[#f3e8d8] text-[#ad8552]',
  main: 'mr-[240px] min-h-[100vh] max-[1200.01px]:mr-[215px] max-[900.01px]:mr-[180px] max-[650.01px]:m-0',
  topbar:
    'flex items-center justify-between p-[0_35px] h-[75px] border-b border-solid border-b-[#e5e9e2] text-[11px] text-[#7e8980] bg-white [&>div]:flex [&>div]:items-center [&>div]:gap-[25px] max-[1200.01px]:p-[0_25px] max-[900.01px]:p-[0_20px] max-[900.01px]:text-[10px] max-[650.01px]:h-[47px] max-[650.01px]:p-[0_17px] max-[650.01px]:text-[9px]',
  'topbar-separator': 'm-[0_13px] text-[#cbd1c8]',
  connection:
    'flex items-center gap-[6px] text-[10px] [&_i]:w-[6px] [&_i]:h-[6px] [&_i]:rounded-full [&_i]:bg-[#779b76] [&_i]:inline-block [&[data-ui~=offline]]:text-[#a7433c] [&[data-ui~=offline]_i]:bg-[#a7433c]',
  'live-label':
    '[&_i]:w-[6px] [&_i]:h-[6px] [&_i]:rounded-full [&_i]:bg-[#779b76] [&_i]:inline-block text-[8px] flex items-center gap-[5px] text-[#9aaa86]',
  'topbar-date':
    'border-r border-solid border-r-[#e5e9e2] pr-[22px] max-[900.01px]:hidden',
  workspace:
    'max-w-[1600px] m-auto p-[31px_35px_20px] max-[1200.01px]:p-[25px] max-[900.01px]:p-[22px_20px] max-[650.01px]:p-[22px_16px_16px]',
  'page-heading':
    'flex items-center justify-between gap-[20px] mb-[29px] [&_p]:text-[11px] [&_p]:text-[#7b8580] [&_p]:mt-[7px] max-[900.01px]:items-start max-[900.01px]:[&_p]:text-[10px] max-[900.01px]:[&_p]:max-w-[340px] max-[650.01px]:mb-[23px] max-[650.01px]:gap-[10px] max-[650.01px]:[&_[data-ui~=eyebrow]]:text-[9px] max-[650.01px]:[&_h1]:text-[22px] max-[650.01px]:[&_p]:text-[9px] max-[650.01px]:[&_p]:max-w-[250px]',
  'heading-actions':
    'flex gap-[9px] max-[650.01px]:gap-[6px] max-[650.01px]:[&_[data-ui~=primary]]:text-[9px] max-[650.01px]:[&_[data-ui~=primary]]:p-[7px_10px] max-[650.01px]:[&_[data-ui~=primary]]:gap-[5px] max-[650.01px]:[&_[data-ui~=primary]]:min-h-[36px] max-[650.01px]:[&_[data-ui~=secondary]]:text-[9px] max-[650.01px]:[&_[data-ui~=secondary]]:p-[7px_10px] max-[650.01px]:[&_[data-ui~=secondary]]:gap-[5px] max-[650.01px]:[&_[data-ui~=secondary]]:min-h-[36px] max-[650.01px]:[&_[data-ui~=primary]_svg]:w-[15px] max-[650.01px]:[&_[data-ui~=secondary]_svg]:w-[15px]',
  stats:
    'grid grid-cols-[repeat(3,_1fr)] gap-[18px] mb-[27px] [&>div]:flex [&>div]:items-center [&>div]:gap-[16px] [&>div]:border [&>div]:border-solid [&>div]:border-[#e5e9e2] [&>div]:bg-white [&>div]:rounded-[12px] [&>div]:p-[19px_22px] [&>div>div>span]:text-[11px] [&>div>div>span]:text-[#7b8580] [&_strong]:text-[25px] [&_strong]:flex [&_strong]:items-center [&_strong]:gap-[10px] [&_strong]:leading-[1.5] [&_strong_small]:text-[#929a91] [&_strong_small]:text-[10px] max-[1200.01px]:[&>div]:p-[15px] max-[1200.01px]:[&>div]:gap-[10px] max-[900.01px]:gap-[10px] max-[900.01px]:[&>div]:p-[13px_10px] max-[900.01px]:[&>div]:gap-[8px] max-[900.01px]:[&>div>div>span]:text-[9px] max-[900.01px]:[&_strong]:text-[22px] max-[900.01px]:[&_strong_small]:hidden max-[650.01px]:gap-[8px] max-[650.01px]:mb-[22px] max-[650.01px]:[&>div]:flex-col max-[650.01px]:[&>div]:items-start max-[650.01px]:[&>div]:gap-[7px] max-[650.01px]:[&>div]:p-[12px] max-[650.01px]:[&>div>div>span]:text-[8px] max-[650.01px]:[&_strong]:text-[23px] max-[650.01px]:[&>div>div]:w-full',
  'stat-icon':
    'w-[47px] h-[47px] grid place-items-center rounded-[12px] [&[data-ui~=green]]:bg-[#edf3e8] [&[data-ui~=green]]:text-[#6b8960] [&[data-ui~=orange]]:bg-[#faf0e6] [&[data-ui~=orange]]:text-[#c48c50] [&[data-ui~=neutral]]:bg-[#f0f2ef] [&[data-ui~=neutral]]:text-[#8b998b] max-[900.01px]:w-[35px] max-[900.01px]:h-[35px] max-[900.01px]:rounded-[9px] max-[900.01px]:[&_svg]:w-[17px] max-[650.01px]:w-[29px] max-[650.01px]:h-[29px] max-[650.01px]:rounded-[8px]',
  'section-toolbar':
    'flex items-center justify-between m-[0_0_20px] max-[650.01px]:flex-wrap max-[650.01px]:gap-[12px]',
  tabs: 'flex bg-[#eaece7] rounded-[9px] p-[4px] gap-[3px] [&_button]:p-[7px_16px] [&_button]:text-[#899086] [&_button]:text-[10px] [&_button]:rounded-[6px] [&_button[data-ui~=active]]:bg-white [&_button[data-ui~=active]]:text-[#255a46] [&_button[data-ui~=active]]:font-semibold max-[650.01px]:p-[3px] max-[650.01px]:[&_button]:text-[9px] max-[650.01px]:[&_button]:p-[6px_11px]',
  legend:
    'flex items-center gap-[7px] text-[10px] text-[#92998e] [&_i]:w-[6px] [&_i]:h-[6px] [&_i]:rounded-full [&_i]:inline-block [&_i]:mr-[13px] max-[650.01px]:text-[8px] max-[650.01px]:gap-[5px] max-[650.01px]:[&_i]:mr-[5px] max-[650.01px]:[&_i]:w-[5px] max-[650.01px]:[&_i]:h-[5px]',
  'free-dot': 'bg-[#88a77b]',
  'occupied-dot': 'bg-[#d9aa69]',
  'table-grid':
    'grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-[18px] min-[1500px]:grid-cols-[repeat(4,_1fr)] max-[1200.01px]:grid-cols-[repeat(3,_minmax(0,_1fr))] max-[900.01px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[650.01px]:gap-[12px]',
  'table-card':
    'relative flex flex-col items-center border border-solid border-[#e5e9e2] bg-white rounded-[13px] p-[17px_16px_0] text-right min-h-[239px] [&:hover:not(:disabled)]:border-[#9fb99e] [&:hover:not(:disabled)]:[transform:translateY(-2px)] [&[data-ui~=occupied]]:border-[#e5d7bd] [&[data-ui~=occupied]]:bg-[#fffefb] [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mb-[17px] [&[data-ui~=available]_[data-ui~=table-card-bottom]]:justify-center [&[data-ui~=available]_[data-ui~=table-card-bottom]]:text-[#829d76] min-[1500px]:min-h-[260px] max-[650.01px]:p-[13px_11px_0] max-[650.01px]:min-h-[225px] max-[650.01px]:[&_h3]:text-[12px]',
  'table-card-top':
    'flex justify-between items-center w-full text-[10px] [&>small]:text-[#a1a79c] [&>small]:text-[9px] max-[650.01px]:[&>small]:text-[8px]',
  'table-status':
    'flex items-center gap-[5px] text-[#7e9974] text-[9px] [&_i]:inline-block [&_i]:w-[5px] [&_i]:h-[5px] [&_i]:bg-[#8eac7f] [&_i]:rounded-full [&[data-ui~=in-service]]:text-[#bb9355] [&[data-ui~=in-service]_i]:bg-[#c5a065] max-[650.01px]:text-[8px]',
  'table-illustration':
    'relative w-[80px] h-[80px] m-[21px_0_11px] min-[1500px]:mt-[28px] max-[650.01px]:m-[19px_0_10px] max-[650.01px]:w-[74px] max-[650.01px]:h-[74px]',
  'table-surface':
    'absolute inset-[8px] grid place-items-center bg-[#f1f5ed] border border-solid border-[#d6e0cf] rounded-[14px] text-[25px] text-[#74916b] z-[1] max-[650.01px]:text-[23px]',
  chair:
    'absolute w-[23px] h-[9px] bg-[#e8eee1] border border-solid border-[#d5dfce] rounded-[4px]',
  c1: 'top-0 left-[29px] max-[650.01px]:left-[25px]',
  c2: 'bottom-0 left-[29px] max-[650.01px]:left-[25px]',
  c3: 'left-[-6px] top-[35px] [transform:rotate(90deg)] max-[650.01px]:top-[31px]',
  c4: 'right-[-6px] top-[35px] [transform:rotate(90deg)] max-[650.01px]:top-[31px]',
  occupied:
    '[&_[data-ui~=table-surface]]:bg-[#faf1df] [&_[data-ui~=table-surface]]:border-[#e7d6b5] [&_[data-ui~=table-surface]]:text-[#b6945c] [&_[data-ui~=chair]]:bg-[#f6ecd6] [&_[data-ui~=chair]]:border-[#e8d9bd]',
  'table-card-bottom':
    'w-full flex justify-between items-center min-h-[42px] border-t border-dashed border-t-[#e9ece4] text-[9px] text-[#7f8979] mt-auto [&>span]:flex [&>span]:items-center [&>span]:gap-[5px] [&_small]:text-[8px] max-[650.01px]:text-[8px] max-[650.01px]:min-h-[40px] max-[650.01px]:[&_small]:text-[7px] max-[650.01px]:[&>span]:gap-[3px]',
  'ready-label': 'bg-[#e8f2e4] text-[#6b8e5b] p-[2px_7px] rounded-[5px]',
  'section-footnote':
    'flex items-center gap-[6px] text-[10px] text-[#9ca495] justify-center m-[24px_0]',
  'workspace-footer':
    'flex justify-between gap-[20px] text-[#a5aca1] text-[9px] border-t border-solid border-t-[#e5e9e2] mt-[35px] pt-[18px] max-[650.01px]:text-[8px] max-[650.01px]:gap-[10px] max-[650.01px]:mt-[25px]',
  alert:
    'rounded-[9px] p-[12px_16px] mb-[18px] flex items-center justify-between text-[12px] gap-[12px] [&[data-ui~=error]]:bg-[#fbeeea] [&[data-ui~=error]]:text-[#a24e44] [&[data-ui~=success]]:bg-[#e8f2e9] [&[data-ui~=success]]:text-[#487d53] [&_button]:text-[18px] [&_button:not([aria-label])]:text-[12px] [&_button:not([aria-label])]:underline [&_button:not([aria-label])]:whitespace-nowrap max-[650.01px]:text-[10px]',
  'form-error':
    'bg-[#fbeeea] text-[#a24e44] p-[9px_12px] rounded-[8px] text-[11px]',
  'search-box':
    'flex items-center gap-[10px] border border-solid border-[#e5e9e2] bg-white rounded-[9px] p-[0_13px] text-[#9aa496] min-w-[250px] [&_input]:border-0 [&_input]:bg-none [&_input]:bg-transparent [&_input]:shadow-none [&_input]:pr-0 [&_input]:text-[11px] max-[650.01px]:min-w-full max-[650.01px]:p-[0_11px]',
  'category-tabs':
    'flex gap-[8px] flex-wrap m-[18px_0] [&_button]:border [&_button]:border-solid [&_button]:border-[#e5e9e2] [&_button]:rounded-[8px] [&_button]:bg-white [&_button]:p-[6px_13px] [&_button]:text-[11px] [&_button]:text-[#84907e] [&_button[data-ui~=active]]:bg-[#255a46] [&_button[data-ui~=active]]:border-[#255a46] [&_button[data-ui~=active]]:text-[white] max-[650.01px]:gap-[6px] max-[650.01px]:m-[13px_0] max-[650.01px]:[&_button]:text-[9px] max-[650.01px]:[&_button]:p-[5px_9px]',
  'order-layout':
    'grid grid-cols-[minmax(0,_1fr)_350px] gap-[25px] items-start max-[1200.01px]:grid-cols-[minmax(0,_1fr)_300px] max-[1200.01px]:gap-[15px] max-[900.01px]:grid-cols-[1fr]',
  'food-grid':
    'grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-[15px] min-[1500px]:grid-cols-[repeat(3,_1fr)] max-[1200.01px]:grid-cols-[1fr] max-[900.01px]:grid-cols-[repeat(2,_1fr)] max-[650.01px]:gap-[10px]',
  'food-card':
    'flex flex-col border border-solid border-[#e5e9e2] rounded-[12px] bg-white overflow-hidden max-[1200.01px]:flex-row max-[900.01px]:flex-col',
  'food-symbol':
    'h-[85px] bg-[#ebeede] flex items-center justify-center gap-[9px] text-[#8d9d7c] [&_small]:text-[11px] [&[data-ui~=category-1]]:bg-[#f5ebd9] [&[data-ui~=category-1]]:text-[#b4a17f] [&[data-ui~=category-2]]:bg-[#e4ece5] [&[data-ui~=category-2]]:text-[#7b9986] [&[data-ui~=category-3]]:bg-[#f0e6dd] [&[data-ui~=category-3]]:text-[#b19a86] [&[data-ui~=category-4]]:bg-[#eee8dc] [&[data-ui~=category-4]]:text-[#a99a7e] max-[1200.01px]:min-w-[70px] max-[1200.01px]:h-auto max-[1200.01px]:flex-col max-[1200.01px]:gap-[3px] max-[1200.01px]:[&_small]:text-[8px] max-[900.01px]:h-[60px] max-[900.01px]:flex-row',
  'food-details':
    'p-[14px] [&_h3]:text-[12px] [&_h3]:mt-[2px] [&_p]:text-[10px] [&_p]:text-[#929a8b] [&_p]:leading-[2] [&_p]:min-h-[40px] [&_p]:m-[6px_0_11px] [&>div]:flex [&>div]:justify-between [&>div]:items-center [&_strong]:text-[12px] [&_small]:text-[9px] [&_small]:text-[#9da692] [&_button]:w-[32px] [&_button]:h-[32px] [&_button]:grid [&_button]:place-items-center [&_button]:border [&_button]:border-solid [&_button]:border-[#dce6d6] [&_button]:bg-[#eff5eb] [&_button]:text-[#6f8e62] [&_button]:rounded-[8px] max-[1200.01px]:flex-1 max-[650.01px]:p-[12px] max-[650.01px]:[&_h3]:text-[11px] max-[650.01px]:[&_p]:text-[9px] max-[650.01px]:[&_p]:min-h-[50px] max-[650.01px]:[&_strong]:text-[10px] max-[650.01px]:[&_small]:text-[8px] max-[650.01px]:[&_button]:w-[42px] max-[650.01px]:[&_button]:h-[42px]',
  'food-category': 'text-[9px] text-[#a2a99a]',
  unavailable: 'block text-[#b17d56] text-[9px]',
  'order-ticket':
    'bg-[white] border border-solid border-[#e5e9e2] rounded-[13px] p-[20px] sticky top-[20px] max-[900.01px]:static max-[650.01px]:p-[17px]',
  'ticket-heading':
    'flex items-center justify-between pb-[16px] border-b border-dashed border-b-[#e5e9e2] [&_h2]:text-[14px] [&_span]:text-[9px] [&_span]:text-[#7b8580] [&>svg]:text-[#93a087]',
  'ticket-items':
    'min-h-[150px] max-h-[55vh] overflow-auto max-[900.01px]:max-h-[none]',
  'ticket-item':
    'p-[17px_0] border-b border-solid border-b-[#f0f2ed] [&>div]:flex [&>div]:justify-between [&>div]:items-center [&>div]:gap-[10px] [&_strong]:text-[11px] [&>div>span:not([data-ui~=badge])]:text-[11px] [&>div+div]:mt-[12px] [&_small]:text-[8px] [&_small]:text-[#7b8580]',
  badge:
    'inline-flex items-center gap-[5px] whitespace-nowrap p-[3px_8px] rounded-[5px] text-[9px] leading-[1.8] [&_i]:inline-block [&_i]:w-[4px] [&_i]:h-[4px] [&_i]:bg-current [&_i]:rounded-full [&[data-ui~=pending]]:bg-[#f6f1e7] [&[data-ui~=pending]]:text-[#b39a6d] [&[data-ui~=preparing]]:bg-[#f9eddf] [&[data-ui~=preparing]]:text-[#bc8b4a] [&[data-ui~=ready]]:bg-[#eaf2e6] [&[data-ui~=ready]]:text-[#799668] [&[data-ui~=served]]:bg-[#edf1eb] [&[data-ui~=served]]:text-[#8f9e89]',
  quantity:
    'flex items-center border border-solid border-[#e5e9e2] rounded-[6px] h-[29px] [&_button]:w-[29px] [&_button]:h-[28px] [&_button]:p-0 [&_button]:text-[#829479] [&_span]:text-[10px] [&_span]:min-w-[18px] [&_span]:text-center max-[650.01px]:h-[42px] max-[650.01px]:[&_button]:min-w-[40px] max-[650.01px]:[&_button]:min-h-[40px]',
  'item-count': 'text-[#8b9884]',
  'serve-button':
    'flex items-center justify-center gap-[5px] w-full rounded-[6px] bg-[#edf5e8] text-[#688c56] text-[10px] p-[7px] mt-[10px]',
  'ticket-total':
    'flex items-center justify-between p-[20px_0] text-[11px] [&_strong]:text-[18px] [&_small]:text-[9px] [&_small]:font-normal [&_small]:text-[#9da893] max-[650.01px]:[&_strong]:text-[20px]',
  'complete-button': 'w-full text-[10px] min-h-[44px]',
  'ticket-note':
    'text-center text-[9px] text-[#a1aa98] mt-[12px] leading-[2.2]',
  empty:
    'p-[35px_15px] text-center text-[#96a08d] [&_h3]:text-[12px] [&_h3]:text-[#788d6f] [&_p]:text-[10px] [&_p]:mt-[6px]',
  'empty-icon':
    'inline-grid place-items-center bg-[#f1f4eb] p-[12px] rounded-full mb-[12px]',
  'kitchen-board':
    'grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-[20px] items-start max-[1200.01px]:gap-[12px] max-[900.01px]:grid-cols-[1fr] max-[650.01px]:gap-[18px]',
  'kitchen-column':
    'bg-[#eef0e9] rounded-[12px] p-[15px] min-h-[450px] max-[1200.01px]:p-[10px] max-[900.01px]:min-h-[150px]',
  'column-heading':
    'flex items-center justify-between mb-[19px] [&>[data-ui~=badge]]:text-[11px] [&>[data-ui~=badge]]:p-[5px_9px] [&>span:last-child]:text-[11px] [&>span:last-child]:text-[#9da693] [&>span:last-child]:border [&>span:last-child]:border-solid [&>span:last-child]:border-[#dce1d5] [&>span:last-child]:bg-white [&>span:last-child]:rounded-[6px] [&>span:last-child]:p-[0_7px]',
  'kitchen-card':
    'bg-white border border-solid border-[#dfe5d7] rounded-[10px] p-[16px] mb-[13px] [&_h3]:text-[12px] [&_h3]:m-[17px_0_6px] [&_h3>span]:inline-block [&_h3>span]:ml-[6px] [&_h3>span]:bg-[#f1f4ec] [&_h3>span]:p-[0_7px] [&_h3>span]:rounded-[5px] [&_h3>span]:font-normal [&_h3>span]:text-[#8d9e80] [&>small]:text-[8px] [&>small]:text-[#a8b09e] [&_button]:w-full [&_button]:justify-between [&_button]:text-[10px] [&_button]:mt-[18px] [&_button]:min-h-[35px] [&_button]:p-[7px_10px] max-[1200.01px]:p-[12px] max-[900.01px]:inline-block max-[900.01px]:w-[calc(50%_-_8px)] max-[900.01px]:m-[0_4px_10px] max-[900.01px]:align-top max-[650.01px]:w-full max-[650.01px]:m-[0_0_12px] max-[650.01px]:p-[17px]',
  'kitchen-card-top':
    'flex items-center justify-between text-[11px] [&>span]:flex [&>span]:items-center [&>span]:gap-[4px] [&>span]:text-[9px] [&>span]:text-[#a5ad9c]',
  'waiting-serve':
    'border-t border-dashed border-t-[#e5e9e2] mt-[18px] pt-[11px] text-[10px] text-center text-[#839875]',
  'column-empty':
    'p-[40px_10px] text-center text-[11px] text-[#a0aa94] max-[900.01px]:p-[15px]',
  'menu-toolbar':
    'flex justify-between items-center gap-[20px] mb-[20px] [&>[data-ui~=search-box]]:w-[350px] [&>span]:text-[10px] [&>span]:text-[#929d89] max-[900.01px]:[&>[data-ui~=search-box]]:w-auto max-[900.01px]:[&>[data-ui~=search-box]]:flex-1 max-[900.01px]:[&>[data-ui~=search-box]]:min-w-[100px] max-[900.01px]:[&>span]:hidden max-[650.01px]:[&_[data-ui~=search-box]]:min-w-[100px]',
  'menu-list':
    'bg-white border border-solid border-[#e5e9e2] rounded-[12px] overflow-hidden',
  'menu-list-header':
    'grid grid-cols-[2.4fr_0.8fr_1fr_0.9fr_0.5fr] items-center gap-[15px] p-[18px_22px] bg-[#f0f3eb] text-[10px] text-[#95a187] pt-[11px] pb-[11px] max-[1200.01px]:grid-cols-[1.6fr_0.7fr_0.9fr_0.8fr_0.5fr] max-[1200.01px]:gap-[10px] max-[1200.01px]:p-[15px] max-[900.01px]:grid-cols-[1.8fr_1fr_0.8fr_0.5fr] max-[900.01px]:[&>span:nth-child(2)]:hidden max-[650.01px]:hidden',
  'menu-row':
    'grid grid-cols-[2.4fr_0.8fr_1fr_0.9fr_0.5fr] items-center gap-[15px] p-[18px_22px] border-t border-solid border-t-[#edf0e7] text-[11px] [&_strong]:text-[11px] [&_p]:text-[9px] [&_p]:text-[#9ba68e] [&_p]:mt-[4px] [&>[data-ui~=badge]]:justify-self-start [&>[data-ui~=badge]]:text-[8px] max-[1200.01px]:grid-cols-[1.6fr_0.7fr_0.9fr_0.8fr_0.5fr] max-[1200.01px]:gap-[10px] max-[1200.01px]:p-[15px] max-[1200.01px]:[&>span:not([data-ui~=badge])]:text-[10px] max-[900.01px]:grid-cols-[1.8fr_1fr_0.8fr_0.5fr] max-[900.01px]:[&>span:nth-child(2)]:hidden max-[650.01px]:grid-cols-[1fr_auto] max-[650.01px]:gap-[8px] max-[650.01px]:p-[15px] max-[650.01px]:[&>div]:col-[1/-1] max-[650.01px]:[&>strong]:col-[1] max-[650.01px]:[&>strong]:row-[2] max-[650.01px]:[&>[data-ui~=badge]]:col-[1] max-[650.01px]:[&>[data-ui~=badge]]:row-[3] max-[650.01px]:[&>button]:col-[2] max-[650.01px]:[&>button]:row-[2/4] max-[650.01px]:[&>button]:self-center',
  'text-button':
    'text-[10px] text-[#65865a] underline underline-offset-[4px] p-[7px]',
  'history-list':
    'bg-white border border-solid border-[#e5e9e2] rounded-[12px] overflow-hidden',
  'history-row':
    'flex items-center gap-[20px] w-full text-right p-[18px_22px] border-b border-solid border-b-[#e5e9e2] text-[11px] [&:last-child]:border-0 [&:hover]:bg-[#f6f8f2] [&>div]:ml-auto [&>div_strong]:block [&>div_small]:block [&_small]:text-[#a0a995] [&_small]:text-[9px] [&>[data-ui~=badge]]:min-w-[70px] [&>[data-ui~=badge]]:justify-center max-[650.01px]:gap-[10px] max-[650.01px]:p-[14px_12px] max-[650.01px]:text-[9px] max-[650.01px]:flex-wrap max-[650.01px]:[&_[data-ui~=history-icon]]:w-[27px] max-[650.01px]:[&_[data-ui~=history-icon]]:h-[32px] max-[650.01px]:[&>span:nth-child(3)]:hidden max-[650.01px]:[&>[data-ui~=badge]]:text-[8px] max-[650.01px]:[&>[data-ui~=badge]]:min-w-[55px] max-[650.01px]:[&>svg]:hidden max-[650.01px]:[&_strong]:text-[10px] max-[650.01px]:[&_small]:text-[8px]',
  'history-icon':
    'w-[37px] h-[40px] grid place-items-center bg-[#f0f3e9] text-[#91a27f] rounded-[8px]',
  'modal-backdrop':
    'fixed inset-0 bg-[#182c2259] backdrop-blur-[3px] flex items-center justify-center z-[50] p-[20px] max-[650.01px]:p-[12px]',
  modal:
    'bg-white rounded-[16px] p-[27px] w-[510px] max-h-[90vh] overflow-auto [&_header]:flex [&_header]:justify-between [&_header]:items-center [&_header]:mb-[23px] [&_header>button]:text-[25px] [&_header>button]:text-[#97a48d] [&_header>button]:self-start [&_h2]:text-[19px] [&_form]:flex [&_form]:flex-col [&_form]:gap-[17px] [&>[data-ui~=muted]]:m-[-8px_0_20px] max-[650.01px]:p-[21px] max-[650.01px]:w-full max-[650.01px]:max-h-[92vh] max-[650.01px]:[&_h2]:text-[17px] max-[650.01px]:[&_label]:text-[10px] max-[650.01px]:[&_input]:text-[12px] max-[650.01px]:[&_textarea]:text-[12px] max-[650.01px]:[&_select]:text-[12px]',
  'form-grid': 'grid grid-cols-[1fr_1fr] gap-[15px] max-[650.01px]:gap-[12px]',
  'check-row':
    'flex gap-[20px] [&_label]:flex [&_label]:flex-row [&_label]:items-center [&_label]:font-normal [&_label]:text-[10px] [&_input]:w-auto [&_input]:accent-[#255a46] max-[650.01px]:gap-[15px]',
  'ai-button': 'text-[#6e805d]',
  'ai-processing':
    'text-center p-[35px_15px] bg-[#f5f7ef] rounded-[10px] text-[#74915f] m-[15px_0] [&_h3]:m-[14px_0_5px] [&_p]:text-[11px] [&_p]:text-[#99a68b] [&_button]:mt-[15px]',
  'review-note':
    'bg-[#fbf2e4] text-[#aa8d5f] text-[10px] p-[12px] rounded-[8px]',
  spinner:
    'w-[25px] h-[25px] border-[2px] border-solid border-[#d8e4cf] border-t-[#779b63] rounded-full inline-block animate-spin',
  'login-page':
    'min-h-[100vh] grid grid-cols-[1fr_1.05fr] bg-white max-[650.01px]:block',
  'login-form':
    'p-[55px_15%] flex flex-col justify-center max-w-[750px] w-full m-auto min-h-[100vh] [&>[data-ui~=brand]]:mb-[60px] [&_form]:flex [&_form]:flex-col [&_form]:gap-[20px] [&_label]:text-[11px] [&_footer]:text-[#b0b8a6] [&_footer]:text-[9px] [&_footer]:mt-[55px] max-[1200.01px]:p-[40px_12%] max-[900.01px]:p-[35px_11%] max-[650.01px]:min-h-[100vh] max-[650.01px]:p-[30px_30px] max-[650.01px]:max-w-[450px] max-[650.01px]:[&>[data-ui~=brand]]:mb-[55px] max-[650.01px]:[&_[data-ui~=brand-mark]]:w-[42px] max-[650.01px]:[&_[data-ui~=brand-mark]]:h-[45px] max-[650.01px]:[&_[data-ui~=brand-mark]]:text-[35px] max-[650.01px]:[&_[data-ui~=brand]_strong]:text-[29px] max-[650.01px]:[&_[data-ui~=brand]_small]:block max-[650.01px]:[&_footer]:mt-[40px]',
  'login-heading':
    'mb-[29px] [&_h1]:text-[27px] [&_[data-ui~=eyebrow]]:text-[11px] [&_[data-ui~=eyebrow]]:text-[#8e9a85] [&_[data-ui~=eyebrow]]:mb-[10px] [&_p]:text-[11px] [&_p]:text-[#9aa48f] [&_p]:mt-[9px] max-[900.01px]:[&_h1]:text-[23px] max-[650.01px]:[&_h1]:text-[26px]',
  'login-submit': 'justify-between w-full mt-[6px]',
  'demo-note':
    'border border-solid border-[#e6ebdd] rounded-[10px] bg-[#f9faf6] p-[15px] mt-[25px] [&_strong]:text-[11px] [&_strong]:text-[#8a9b79] [&_p]:text-[10px] [&_p]:leading-[2.2] [&_p]:text-[#9ba68c] [&_p]:mt-[6px]',
  'login-art':
    "relative bg-[#eaf0df] overflow-hidden p-[65px_12%] flex flex-col justify-center [&:before]:content-[''] [&:before]:absolute [&:before]:border [&:before]:border-solid [&:before]:border-[#dbe4cb] [&:before]:w-[550px] [&:before]:h-[550px] [&:before]:rounded-full [&:before]:top-[-250px] [&:before]:left-[-150px] max-[1200.01px]:p-[50px_12%] max-[900.01px]:p-[45px_10%] max-[650.01px]:hidden",
  'art-caption':
    '[&_[data-ui~=eyebrow]]:text-[#8c9c76] [&_[data-ui~=eyebrow]]:text-[11px] [&_h2]:text-[38px] [&_h2]:leading-[1.8] [&_h2]:text-[#45683b] [&_h2]:tracking-[-1px] [&_h2]:mt-[17px] [&_h2]:font-medium [&_p]:text-[12px] [&_p]:text-[#91a17f] [&_p]:leading-[2.3] [&_p]:mt-[17px] max-[900.01px]:[&_h2]:text-[31px]',
  'art-board':
    'relative bg-[#fafbf6] border border-solid border-[#dce5cc] rounded-[18px] mt-[40px] p-[22px_25px_25px] [transform:rotate(-3deg)] w-full max-w-[390px] max-[900.01px]:p-[18px]',
  'art-board-title':
    'flex items-center justify-between text-[11px] text-[#839b6d]',
  'art-tables':
    'grid grid-cols-[repeat(3,_1fr)] gap-[23px] p-[25px_6px] max-[900.01px]:gap-[14px]',
  'art-table':
    "h-[62px] border border-solid border-[#dbe6ce] rounded-[12px] grid place-items-center bg-[#edf4e2] relative text-[17px] text-[#90a57d] [&:before]:content-[''] [&:before]:absolute [&:before]:left-[33%] [&:before]:right-[33%] [&:before]:h-[6px] [&:before]:bg-[#dce9c9] [&:before]:rounded-[3px] [&:before]:top-[-7px] [&:after]:content-[''] [&:after]:absolute [&:after]:left-[33%] [&:after]:right-[33%] [&:after]:h-[6px] [&:after]:bg-[#dce9c9] [&:after]:rounded-[3px] [&:after]:bottom-[-7px] [&[data-ui~=active]]:bg-[#f5ecd8] [&[data-ui~=active]]:border-[#e6d7b4] [&[data-ui~=active]]:text-[#b59a6b] [&[data-ui~=active]:before]:bg-[#e9dbbd] [&[data-ui~=active]:after]:bg-[#e9dbbd] max-[900.01px]:h-[50px]",
  'art-ticket':
    'absolute bottom-[-24px] left-[-24px] right-[28px] flex items-center gap-[10px] border border-solid border-[#d9e3ce] bg-white rounded-[10px] p-[13px_12px] [transform:rotate(5deg)] [&_strong]:text-[10px] [&_strong]:text-[#708b5b] [&_strong]:block [&_small]:block [&_small]:text-[8px] [&_small]:text-[#a2ad94] [&>span:last-child]:text-[8px] [&>span:last-child]:text-[#b1bba5] [&>span:last-child]:mr-auto [&>span:last-child]:whitespace-nowrap max-[1200.01px]:left-[-13px] max-[900.01px]:[&>span:last-child]:hidden',
  'ticket-icon':
    'grid place-items-center w-[33px] h-[33px] bg-[#eef5e5] rounded-full text-[#89a475]',
  'art-bottom':
    'flex items-center gap-[14px] text-[9px] text-[#95a683] mt-[80px] [&_i]:w-[3px] [&_i]:h-[3px] [&_i]:rounded-full [&_i]:bg-[#a9b996] max-[900.01px]:gap-[8px] max-[900.01px]:text-[8px]',
  'loading-screen':
    'flex items-center justify-center flex-col min-h-[100vh] gap-[25px] [&_p]:text-[12px] [&_p]:text-[#7b8580]',
  'mobile-logout':
    'hidden max-[650.01px]:inline-flex max-[650.01px]:items-center max-[650.01px]:justify-center max-[650.01px]:min-w-[44px] max-[650.01px]:min-h-[40px]',
};

export function ui(names: string): { className: string; 'data-ui': string } {
  return {
    className: twMerge(
      names
        .split(/\s+/)
        .map((name) => utilities[name] || '')
        .join(' '),
    ),
    'data-ui': names,
  };
}
