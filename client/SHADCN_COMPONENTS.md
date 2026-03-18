# 🎨 shadCN UI Components - Complete Guide

Your project now has **31+ professional UI components** fully installed and ready to use!

## 📦 What's Installed

### Import Pattern
All components can be imported from `@/components`:

```tsx
import { Button, Input, Card, Dialog, Tabs } from '@/components';
```

Or directly from the UI folder:

```tsx
import { Button } from '@/components/ui/button';
```

---

## 📂 Component Categories

### 1️⃣ **Forms & Inputs** (9 components)
Perfect for creating forms and capturing user input.

| Component | Use Case |
|-----------|----------|
| `Button` | Clickable buttons with variants |
| `Input` | Text input fields |
| `Label` | Form labels |
| `Textarea` | Multi-line text input |
| `Checkbox` | Checkbox inputs |
| `Switch` | Toggle switches |
| `Slider` | Range sliders |
| `Select` | Dropdown selections |
| `Form` | Form control with validation |

**Example:**
```tsx
import { Button, Input, Label } from '@/components';

export default function LoginForm() {
  return (
    <form className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="user@example.com" />
      </div>
      <Button type="submit">Login</Button>
    </form>
  );
}
```

---

### 2️⃣ **Layout & Containers** (4 components)
For structuring your page layout.

| Component | Use Case |
|-----------|----------|
| `Card` | Content containers with sections |
| `Separator` | Divider lines |
| `ScrollArea` | Scrollable content with custom scrollbar |
| `Sidebar` | Navigation sidebar |

**Example:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components';

export default function UserCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Content goes here */}
      </CardContent>
    </Card>
  );
}
```

---

### 3️⃣ **Dialog & Modals** (3 components)
For modals, popovers, and overlays.

| Component | Use Case |
|-----------|----------|
| `Dialog` | Modal dialogs |
| `Popover` | Floating popovers |
| `Sheet` | Side panels/drawers |

**Example:**
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, Button } from '@/components';

export default function ConfirmDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Delete Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p>This action cannot be undone.</p>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 4️⃣ **Data Display** (5 components)
For showing data and information.

| Component | Use Case |
|-----------|----------|
| `Badge` | Status badges |
| `Avatar` | User avatars |
| `Alert` | Alert messages |
| `Table` | Data tables |
| `Skeleton` | Loading placeholders |

**Example:**
```tsx
import { Badge, Avatar, AvatarImage, AvatarFallback } from '@/components';

export default function UserBadge() {
  return (
    <div className="flex items-center gap-2">
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
      <Badge>Admin</Badge>
    </div>
  );
}
```

---

### 5️⃣ **Navigation** (5 components)
For menus and navigation controls.

| Component | Use Case |
|-----------|----------|
| `Tabs` | Tab navigation |
| `DropdownMenu` | Dropdown menus |
| `ContextMenu` | Right-click menus |
| `Pagination` | Page navigation |
| `Command` | Command palette/search |

**Example:**
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components';

export default function TabsExample() {
  return (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
    </Tabs>
  );
}
```

---

### 6️⃣ **Feedback** (3 components)
For user feedback and progress indication.

| Component | Use Case |
|-----------|----------|
| `Progress` | Progress bars |
| `Accordion` | Expandable sections |
| `Tooltip` | Hover tooltips |

**Example:**
```tsx
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components';

export default function TooltipExample() {
  return (
    <Tooltip>
      <TooltipTrigger>Hover me</TooltipTrigger>
      <TooltipContent>Helpful information here</TooltipContent>
    </Tooltip>
  );
}
```

---

### 7️⃣ **Toast Notifications**
Real-time notifications powered by **Sonner**.

```tsx
import { toast } from 'sonner';

export default function NotificationExample() {
  return (
    <>
      <button onClick={() => toast.success('Success!')}>
        Success Toast
      </button>
      <button onClick={() => toast.error('Error!')}>
        Error Toast
      </button>
      <button onClick={() => toast.loading('Loading...')}>
        Loading Toast
      </button>
    </>
  );
}
```

---

### 8️⃣ **Other Utilities** (2 components)
Miscellaneous useful components.

| Component | Use Case |
|-----------|----------|
| `Calendar` | Date picker calendar |
| `Collapsible` | Collapsible sections |

---

## 🎯 Quick Reference

### Most Common Components
```tsx
// Forms
import { Button, Input, Label, Textarea, Select, Checkbox, Switch } from '@/components';

// Layout
import { Card, CardHeader, CardContent, CardTitle, Separator } from '@/components';

// Dialogs
import { Dialog, DialogTrigger, DialogContent } from '@/components';

// Data
import { Table, Badge, Avatar, Alert } from '@/components';

// Navigation
import { Tabs, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components';

// Notifications
import { toast } from 'sonner';
```

---

## 🎨 Theming

All components automatically use the CSS variables defined in `src/app/globals.css`:

- `--primary` - Primary brand color
- `--secondary` - Secondary color
- `--success` - Success state
- `--warning` - Warning state
- `--danger` - Destructive/danger state
- `--info` - Info state

Change these variables to customize all components at once!

---

## 📚 Learn More

- **Full Documentation:** https://ui.shadcn.com/docs
- **Component Gallery:** https://ui.shadcn.com/docs/components
- **Tailwind CSS:** https://tailwindcss.com/docs

---

## 🚀 Pro Tips

1. **Use `asChild` prop** - Combine components for better composition
2. **Customize with className** - All components accept Tailwind classes
3. **Leverage variants** - Most components have style variants
4. **Check examples** - shadCN docs have great examples for each component
5. **Toast for feedback** - Use Sonner for all notifications

---

**Start building amazing UIs! 🎉**
