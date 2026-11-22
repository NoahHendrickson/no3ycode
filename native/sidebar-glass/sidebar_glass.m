// Native macOS Liquid Glass sidebar & draft composer addon for T3 Code desktop.
//
// On macOS 27+, mounts AppKit's NSSplitViewController +
// NSSplitViewItem.sidebarWithViewController: behind Chromium's web view so the
// docked sidebar gets native Liquid Glass blur and live edge refraction.
// On macOS 26, falls back to a framed inset NSGlassEffectView. On macOS < 26 or
// when Reduce Transparency / Increase Contrast is enabled, reports unsupported
// so Electron keeps its built-in vibrancy fallback.

#import <AppKit/AppKit.h>
#import <QuartzCore/QuartzCore.h>
#import <objc/message.h>
#import <objc/runtime.h>
#include <node_api.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>

static void run_on_main(dispatch_block_t block) {
  if ([NSThread isMainThread]) {
    block();
  } else {
    dispatch_sync(dispatch_get_main_queue(), block);
  }
}

static NSInteger macos_major_version(void) {
  return NSProcessInfo.processInfo.operatingSystemVersion.majorVersion;
}

static bool glass_accessibility_blocked(void) {
  NSWorkspace *ws = NSWorkspace.sharedWorkspace;
  return ws.accessibilityDisplayShouldReduceTransparency ||
         ws.accessibilityDisplayShouldIncreaseContrast;
}

static bool is_liquid_glass_supported_on_main(void) {
  if (glass_accessibility_blocked()) return false;
  NSInteger major = macos_major_version();
  if (major >= 27) return true;
  if (major >= 26 && NSClassFromString(@"NSGlassEffectView") != nil) return true;
  return false;
}

@interface T3UnderSiblingsLayer : CALayer
@end

@implementation T3UnderSiblingsLayer
- (CGFloat)zPosition {
  return -1000.0;
}
- (void)setZPosition:(CGFloat)zPosition {
  (void)zPosition;
  [super setZPosition:-1000.0];
}
@end

@interface T3SidebarGlassHolder : NSView
@property(nonatomic, strong, nullable) NSSplitViewController *splitVC;
@property(nonatomic, strong, nullable) NSSplitViewItem *sidebarItem;
@property(nonatomic, strong, nullable) NSView *glassView;
@property(nonatomic, assign) BOOL usingSplitView;
@end

@implementation T3SidebarGlassHolder
- (instancetype)initWithFrame:(NSRect)frameRect {
  self = [super initWithFrame:frameRect];
  if (self != nil) {
    self.wantsLayer = YES;
  }
  return self;
}

- (CALayer *)makeBackingLayer {
  T3UnderSiblingsLayer *layer = [T3UnderSiblingsLayer layer];
  layer.zPosition = -1000.0;
  return layer;
}

- (NSView *)hitTest:(NSPoint)point {
  (void)point;
  return nil;
}

- (BOOL)isAccessibilityElement {
  return NO;
}

- (NSArray *)accessibilityChildren {
  return @[];
}
@end

static const void *kHolderAssocKey = &kHolderAssocKey;
static const void *kDraftHolderAssocKey = &kDraftHolderAssocKey;

typedef struct {
  CGFloat x;
  CGFloat y;
  CGFloat width;
  CGFloat height;
  CGFloat cornerRadius;
} T3GlassCardRect;

@interface T3DraftBackdropView : NSView
@property(nonatomic, strong, nullable) NSBitmapImageRep *imageRep;
@end

@implementation T3DraftBackdropView
- (instancetype)initWithFrame:(NSRect)frameRect {
  self = [super initWithFrame:frameRect];
  if (self != nil) {
    self.wantsLayer = YES;
    self.layerContentsRedrawPolicy = NSViewLayerContentsRedrawOnSetNeedsDisplay;
  }
  return self;
}

- (BOOL)wantsUpdateLayer {
  return YES;
}

- (void)updateLayer {
  CALayer *layer = self.layer;
  if (layer == nil) return;
  layer.contentsGravity = kCAGravityResize;
  layer.opaque = YES;
  layer.magnificationFilter = kCAFilterNearest;
  layer.minificationFilter = kCAFilterLinear;
  layer.contents = self.imageRep != nil ? (__bridge id)self.imageRep.CGImage : nil;
}

- (NSView *)hitTest:(NSPoint)point {
  (void)point;
  return nil;
}
@end

@interface T3DraftGlassHolder : NSView
@property(nonatomic, strong) T3DraftBackdropView *imageView;
@property(nonatomic, strong) NSMutableArray<NSView *> *cardViews;
@property(nonatomic, copy, nullable) NSString *imageKey;
@end

@implementation T3DraftGlassHolder
- (instancetype)initWithFrame:(NSRect)frameRect {
  self = [super initWithFrame:frameRect];
  if (self != nil) {
    self.wantsLayer = YES;
    self.layer.masksToBounds = YES;
    _imageView = [[T3DraftBackdropView alloc] initWithFrame:NSZeroRect];
    [self addSubview:_imageView];
    _cardViews = [NSMutableArray array];
  }
  return self;
}

- (CALayer *)makeBackingLayer {
  T3UnderSiblingsLayer *layer = [T3UnderSiblingsLayer layer];
  layer.zPosition = -1000.0;
  layer.masksToBounds = YES;
  return layer;
}

- (NSView *)hitTest:(NSPoint)point {
  (void)point;
  return nil;
}

- (BOOL)isAccessibilityElement {
  return NO;
}

- (NSArray *)accessibilityChildren {
  return @[];
}
@end

static NSColor *color_from_rgb24(uint32_t rgb) {
  CGFloat r = ((rgb >> 16) & 0xFF) / 255.0;
  CGFloat g = ((rgb >> 8) & 0xFF) / 255.0;
  CGFloat b = (rgb & 0xFF) / 255.0;
  return [NSColor colorWithSRGBRed:r green:g blue:b alpha:1.0];
}

static NSView *root_view_from_handle(napi_env env, napi_value val) {
  bool is_buf = false;
  if (napi_is_buffer(env, val, &is_buf) != napi_ok || !is_buf) return nil;
  void *data = NULL;
  size_t len = 0;
  if (napi_get_buffer_info(env, val, &data, &len) != napi_ok || data == NULL ||
      len < sizeof(void *)) {
    return nil;
  }
  return *(__unsafe_unretained NSView **)data;
}

static void apply_sidebar_width(T3SidebarGlassHolder *holder, NSView *contentView,
                                CGFloat width) {
  CGFloat contentHeight = contentView.bounds.size.height;
  holder.frame = NSMakeRect(0, 0, width, contentHeight);
  if (holder.usingSplitView) {
    if (holder.sidebarItem != nil) {
      if (width < holder.sidebarItem.minimumThickness) {
        holder.sidebarItem.minimumThickness = width;
        holder.sidebarItem.maximumThickness = width;
      } else {
        holder.sidebarItem.maximumThickness = width;
        holder.sidebarItem.minimumThickness = width;
      }
    }
    if (holder.splitVC != nil) {
      holder.splitVC.view.frame = holder.bounds;
    }
  } else if (holder.glassView != nil) {
    CGFloat inset = 8.0;
    CGFloat insetW = fmax(1.0, width - inset * 2.0);
    CGFloat insetH = fmax(1.0, contentHeight - inset * 2.0);
    holder.glassView.frame = NSMakeRect(inset, inset, insetW, insetH);
  }
}

static bool show_sidebar_glass_on_main(NSView *rootView, CGFloat width, bool hasBacking,
                                       uint32_t backingRgb) {
  if (rootView == nil || width <= 0 || !is_liquid_glass_supported_on_main()) {
    return false;
  }

  NSWindow *window = rootView.window;
  NSView *contentView = window != nil ? window.contentView : rootView;
  if (contentView == nil) return false;

  T3SidebarGlassHolder *holder = objc_getAssociatedObject(contentView, kHolderAssocKey);
  if (holder == nil) {
    CGFloat contentHeight = contentView.bounds.size.height;
    holder = [[T3SidebarGlassHolder alloc] initWithFrame:NSMakeRect(0, 0, width, contentHeight)];
    holder.autoresizingMask = NSViewHeightSizable;

    if (macos_major_version() >= 27) {
      NSViewController *sidebarVC = [[NSViewController alloc] init];
      sidebarVC.view = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, width, contentHeight)];
      NSSplitViewItem *item = [NSSplitViewItem sidebarWithViewController:sidebarVC];
      item.canCollapse = NO;
      item.springLoaded = NO;
      item.minimumThickness = width;
      item.maximumThickness = width;

      NSSplitViewController *splitVC = [[NSSplitViewController alloc] init];
      [splitVC addSplitViewItem:item];
      splitVC.view.frame = holder.bounds;
      splitVC.view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
      splitVC.view.accessibilityElement = NO;
      splitVC.view.accessibilityChildren = @[];
      [holder addSubview:splitVC.view];

      holder.splitVC = splitVC;
      holder.sidebarItem = item;
      holder.usingSplitView = YES;
    } else {
      Class glassCls = NSClassFromString(@"NSGlassEffectView");
      if (glassCls == nil) return false;
      CGFloat inset = 8.0;
      NSRect glassFrame = NSMakeRect(inset, inset, fmax(1.0, width - inset * 2.0),
                                     fmax(1.0, contentHeight - inset * 2.0));
      NSView *glass = [[glassCls alloc] initWithFrame:glassFrame];
      glass.autoresizingMask = NSViewHeightSizable;
      SEL setCornerRadius = sel_registerName("setCornerRadius:");
      if ([glass respondsToSelector:setCornerRadius]) {
        ((void (*)(id, SEL, CGFloat))objc_msgSend)(glass, setCornerRadius, 14.0);
      }
      SEL setVariant = sel_registerName("set_variant:");
      if ([glass respondsToSelector:setVariant]) {
        ((void (*)(id, SEL, long long))objc_msgSend)(glass, setVariant, 16);
      }
      [holder addSubview:glass];
      holder.glassView = glass;
      holder.usingSplitView = NO;
    }

    [contentView addSubview:holder positioned:NSWindowBelow relativeTo:nil];
    objc_setAssociatedObject(contentView, kHolderAssocKey, holder, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  } else {
    apply_sidebar_width(holder, contentView, width);
  }

  if (window != nil) {
    window.opaque = NO;
    window.backgroundColor = hasBacking ? color_from_rgb24(backingRgb) : [NSColor clearColor];
  }

  return true;
}

static bool hide_draft_glass_on_main(NSView *rootView) {
  if (rootView == nil) return false;
  NSWindow *window = rootView.window;
  NSView *contentView = window != nil ? window.contentView : rootView;
  if (contentView == nil) return false;

  T3DraftGlassHolder *holder = objc_getAssociatedObject(contentView, kDraftHolderAssocKey);
  if (holder == nil) return false;

  [holder removeFromSuperview];
  objc_setAssociatedObject(contentView, kDraftHolderAssocKey, nil, OBJC_ASSOCIATION_ASSIGN);
  return true;
}

static bool set_draft_glass_on_main(NSView *rootView, NSRect stageTopDown, NSString *imageKey,
                                    NSData * _Nullable imageData, NSRect imageTopDown,
                                    const T3GlassCardRect *cards, size_t cardCount) {
  if (rootView == nil || stageTopDown.size.width <= 0 || stageTopDown.size.height <= 0 ||
      !is_liquid_glass_supported_on_main()) {
    return false;
  }

  Class glassCls = NSClassFromString(@"NSGlassEffectView");
  if (glassCls == nil) return false;

  NSWindow *window = rootView.window;
  NSView *contentView = window != nil ? window.contentView : rootView;
  if (contentView == nil) return false;

  CGFloat contentHeight = contentView.bounds.size.height;
  CGFloat stageAppKitY = contentHeight - stageTopDown.origin.y - stageTopDown.size.height;
  NSRect stageFrame =
      NSMakeRect(stageTopDown.origin.x, stageAppKitY, stageTopDown.size.width, stageTopDown.size.height);

  T3DraftGlassHolder *holder = objc_getAssociatedObject(contentView, kDraftHolderAssocKey);
  BOOL needsImage =
      holder == nil || holder.imageView.imageRep == nil || ![holder.imageKey isEqualToString:imageKey];
  NSBitmapImageRep *decodedRep = nil;
  if (needsImage) {
    if (imageData == nil || imageData.length == 0) {
      return false;
    }
    decodedRep = [[NSBitmapImageRep alloc] initWithData:imageData];
    if (decodedRep == nil || decodedRep.CGImage == NULL) {
      return false;
    }
  }

  if (holder == nil) {
    holder = [[T3DraftGlassHolder alloc] initWithFrame:stageFrame];
    [contentView addSubview:holder positioned:NSWindowBelow relativeTo:nil];
    objc_setAssociatedObject(contentView, kDraftHolderAssocKey, holder,
                             OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }
  if (decodedRep != nil) {
    holder.imageView.imageRep = decodedRep;
    holder.imageKey = imageKey;
  }

  [CATransaction begin];
  [CATransaction setDisableActions:YES];

  holder.frame = stageFrame;
  holder.layer.masksToBounds = YES;

  CGFloat imgAppKitY = stageTopDown.size.height - imageTopDown.origin.y - imageTopDown.size.height;
  holder.imageView.frame =
      NSMakeRect(imageTopDown.origin.x, imgAppKitY, imageTopDown.size.width, imageTopDown.size.height);
  [holder.imageView setNeedsDisplay:YES];

  NSAppearance *darkAppearance = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];
  NSColor *tint = [NSColor colorWithSRGBRed:0.0 green:0.0 blue:0.0 alpha:0.18];
  SEL setCornerRadius = sel_registerName("setCornerRadius:");
  SEL setStyle = sel_registerName("setStyle:");
  SEL setTintColor = sel_registerName("setTintColor:");

  while (holder.cardViews.count > cardCount) {
    NSView *extra = holder.cardViews.lastObject;
    [extra removeFromSuperview];
    [holder.cardViews removeLastObject];
  }

  for (size_t i = 0; i < cardCount; i++) {
    T3GlassCardRect c = cards[i];
    CGFloat localX = c.x - stageTopDown.origin.x;
    CGFloat localYTop = c.y - stageTopDown.origin.y;
    CGFloat cardAppKitY = stageTopDown.size.height - localYTop - c.height;
    NSRect cardFrame = NSMakeRect(localX, cardAppKitY, c.width, c.height);

    NSView *cardView = nil;
    if (i < holder.cardViews.count) {
      cardView = holder.cardViews[i];
      cardView.frame = cardFrame;
    } else {
      cardView = [[glassCls alloc] initWithFrame:cardFrame];
      cardView.wantsLayer = YES;
      cardView.accessibilityElement = NO;
      cardView.accessibilityChildren = @[];
      cardView.appearance = darkAppearance;
      if ([cardView respondsToSelector:setStyle]) {
        ((void (*)(id, SEL, NSInteger))objc_msgSend)(cardView, setStyle, 0);
      }
      if ([cardView respondsToSelector:setTintColor]) {
        ((void (*)(id, SEL, NSColor *))objc_msgSend)(cardView, setTintColor, tint);
      }
      [holder addSubview:cardView];
      [holder.cardViews addObject:cardView];
    }

    if ([cardView respondsToSelector:setCornerRadius]) {
      ((void (*)(id, SEL, CGFloat))objc_msgSend)(cardView, setCornerRadius, c.cornerRadius);
    }
  }

  [CATransaction commit];
  return true;
}

static bool hide_sidebar_glass_on_main(NSView *rootView) {
  if (rootView == nil) return false;
  NSWindow *window = rootView.window;
  NSView *contentView = window != nil ? window.contentView : rootView;
  if (contentView == nil) return false;

  T3SidebarGlassHolder *holder = objc_getAssociatedObject(contentView, kHolderAssocKey);
  if (holder == nil) return false;

  [holder removeFromSuperview];
  objc_setAssociatedObject(contentView, kHolderAssocKey, nil, OBJC_ASSOCIATION_ASSIGN);
  return true;
}

static bool read_opt_uint32(napi_env env, napi_value obj, const char *key, uint32_t *out) {
  bool has_prop = false;
  if (napi_has_named_property(env, obj, key, &has_prop) != napi_ok || !has_prop) return false;
  napi_value val;
  if (napi_get_named_property(env, obj, key, &val) != napi_ok) return false;
  napi_valuetype type;
  if (napi_typeof(env, val, &type) != napi_ok || type != napi_number) return false;
  double num = 0;
  if (napi_get_value_double(env, val, &num) != napi_ok || !isfinite(num) || num < 0) return false;
  *out = (uint32_t)num;
  return true;
}

static bool read_double_prop(napi_env env, napi_value obj, const char *key, double *out) {
  napi_value val;
  if (napi_get_named_property(env, obj, key, &val) != napi_ok) return false;
  double num = 0;
  if (napi_get_value_double(env, val, &num) != napi_ok || !isfinite(num)) return false;
  *out = num;
  return true;
}

static bool read_rect_prop(napi_env env, napi_value obj, const char *key, NSRect *out) {
  napi_value rectVal;
  if (napi_get_named_property(env, obj, key, &rectVal) != napi_ok) return false;
  double x = 0, y = 0, w = 0, h = 0;
  if (!read_double_prop(env, rectVal, "x", &x) || !read_double_prop(env, rectVal, "y", &y) ||
      !read_double_prop(env, rectVal, "width", &w) ||
      !read_double_prop(env, rectVal, "height", &h)) {
    return false;
  }
  *out = NSMakeRect((CGFloat)x, (CGFloat)y, (CGFloat)w, (CGFloat)h);
  return true;
}

static NSString * _Nullable read_opt_string(napi_env env, napi_value obj, const char *key) {
  bool has_prop = false;
  if (napi_has_named_property(env, obj, key, &has_prop) != napi_ok || !has_prop) return nil;
  napi_value val;
  if (napi_get_named_property(env, obj, key, &val) != napi_ok) return nil;
  napi_valuetype type;
  if (napi_typeof(env, val, &type) != napi_ok || type != napi_string) return nil;
  size_t len = 0;
  if (napi_get_value_string_utf8(env, val, NULL, 0, &len) != napi_ok) return nil;
  char *buf = (char *)malloc(len + 1);
  if (buf == NULL) return nil;
  size_t copied = 0;
  NSString *result = nil;
  if (napi_get_value_string_utf8(env, val, buf, len + 1, &copied) == napi_ok) {
    result = [[NSString alloc] initWithBytes:buf length:copied encoding:NSUTF8StringEncoding];
  }
  free(buf);
  return result;
}

static napi_value napi_is_supported(napi_env env, napi_callback_info info) {
  (void)info;
  __block bool supported = false;
  run_on_main(^{
    supported = is_liquid_glass_supported_on_main();
  });
  napi_value out;
  napi_get_boolean(env, supported, &out);
  return out;
}

static napi_value napi_show(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  napi_value out;
  if (argc < 2) {
    napi_get_boolean(env, false, &out);
    return out;
  }

  NSView *rootView = root_view_from_handle(env, argv[0]);
  napi_value widthVal;
  double width = 0;
  if (rootView == nil ||
      napi_get_named_property(env, argv[1], "width", &widthVal) != napi_ok ||
      napi_get_value_double(env, widthVal, &width) != napi_ok || !isfinite(width) || width <= 0) {
    napi_get_boolean(env, false, &out);
    return out;
  }

  uint32_t backingRgb = 0;
  bool hasBacking = read_opt_uint32(env, argv[1], "backing", &backingRgb);

  __block bool ok = false;
  run_on_main(^{
    ok = show_sidebar_glass_on_main(rootView, (CGFloat)width, hasBacking, backingRgb);
  });

  napi_get_boolean(env, ok, &out);
  return out;
}

static napi_value napi_hide(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  napi_value out;
  if (argc < 1) {
    napi_get_boolean(env, false, &out);
    return out;
  }

  NSView *rootView = root_view_from_handle(env, argv[0]);
  __block bool removed = false;
  run_on_main(^{
    removed = hide_sidebar_glass_on_main(rootView);
  });

  napi_get_boolean(env, removed, &out);
  return out;
}

static napi_value napi_set_draft_glass(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  napi_value out;
  if (argc < 2) {
    napi_get_boolean(env, false, &out);
    return out;
  }

  NSView *rootView = root_view_from_handle(env, argv[0]);
  NSRect stageRect = NSZeroRect;
  NSRect imageRect = NSZeroRect;
  NSString *imageKey = read_opt_string(env, argv[1], "imageKey");
  if (rootView == nil || imageKey == nil || !read_rect_prop(env, argv[1], "stage", &stageRect) ||
      !read_rect_prop(env, argv[1], "image", &imageRect)) {
    napi_get_boolean(env, false, &out);
    return out;
  }

  NSString *imageBase64 = read_opt_string(env, argv[1], "imageBase64");
  NSData *imageData = imageBase64 != nil
                          ? [[NSData alloc] initWithBase64EncodedString:imageBase64 options:0]
                          : nil;

  T3GlassCardRect *cards = NULL;
  size_t cardCount = 0;
  napi_value cardsVal;
  bool isArray = false;
  if (napi_get_named_property(env, argv[1], "cards", &cardsVal) == napi_ok &&
      napi_is_array(env, cardsVal, &isArray) == napi_ok && isArray) {
    uint32_t arrLen = 0;
    if (napi_get_array_length(env, cardsVal, &arrLen) == napi_ok && arrLen > 0) {
      cards = (T3GlassCardRect *)malloc(sizeof(T3GlassCardRect) * arrLen);
      if (cards != NULL) {
        for (uint32_t i = 0; i < arrLen; i++) {
          napi_value elem;
          if (napi_get_element(env, cardsVal, i, &elem) != napi_ok) continue;
          double x = 0, y = 0, w = 0, h = 0, r = 8;
          if (!read_double_prop(env, elem, "x", &x) || !read_double_prop(env, elem, "y", &y) ||
              !read_double_prop(env, elem, "width", &w) ||
              !read_double_prop(env, elem, "height", &h) || w <= 0 || h <= 0) {
            continue;
          }
          read_double_prop(env, elem, "cornerRadius", &r);
          cards[cardCount].x = (CGFloat)x;
          cards[cardCount].y = (CGFloat)y;
          cards[cardCount].width = (CGFloat)w;
          cards[cardCount].height = (CGFloat)h;
          cards[cardCount].cornerRadius = (CGFloat)r;
          cardCount++;
        }
      }
    }
  }

  const T3GlassCardRect *cardsPtr = cards;
  __block bool ok = false;
  run_on_main(^{
    ok = set_draft_glass_on_main(rootView, stageRect, imageKey, imageData, imageRect, cardsPtr,
                                 cardCount);
  });
  free(cards);

  napi_get_boolean(env, ok, &out);
  return out;
}

static napi_value napi_hide_draft_glass(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);

  napi_value out;
  if (argc < 1) {
    napi_get_boolean(env, false, &out);
    return out;
  }

  NSView *rootView = root_view_from_handle(env, argv[0]);
  __block bool removed = false;
  run_on_main(^{
    removed = hide_draft_glass_on_main(rootView);
  });

  napi_get_boolean(env, removed, &out);
  return out;
}

static napi_value init_module(napi_env env, napi_value exports) {
  napi_property_descriptor props[] = {
      {"isSupported", NULL, napi_is_supported, NULL, NULL, NULL, napi_default, NULL},
      {"show", NULL, napi_show, NULL, NULL, NULL, napi_default, NULL},
      {"hide", NULL, napi_hide, NULL, NULL, NULL, napi_default, NULL},
      {"setDraftGlass", NULL, napi_set_draft_glass, NULL, NULL, NULL, napi_default, NULL},
      {"hideDraftGlass", NULL, napi_hide_draft_glass, NULL, NULL, NULL, napi_default, NULL},
  };
  napi_define_properties(env, exports, sizeof(props) / sizeof(props[0]), props);
  return exports;
}

NAPI_MODULE_INIT() {
  return init_module(env, exports);
}
