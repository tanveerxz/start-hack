# shadCN UI Components

Complete collection of shadCN UI components - pre-built, unstyled components built on top of Radix UI and Tailwind CSS.

## 📋 Installed Components

### Forms & Input
- **Button** - Customizable button component
- **Input** - Text input field
- **Label** - Form label
- **Textarea** - Multi-line text input
- **Checkbox** - Checkbox input
- **Switch** - Toggle switch
- **Slider** - Range slider
- **Select** - Dropdown select
- **Form** - Full form control with React Hook Form integration

### Layout & Container
- **Card** - Container with Header, Footer, Title, Description, Content
- **Separator** - Divider line
- **ScrollArea** - Scrollable container with custom scrollbar
- **Sidebar** - Navigation sidebar with multiple sub-components

### Dialog & Modals
- **Dialog** - Modal dialog (TriggerContent, Header, Footer, Title, Description)
- **Popover** - Floating popover container
- **Sheet** - Side panel/drawer (TriggerContent, Header, Footer, Title, Description)

### Data Display
- **Badge** - Status badge
- **Avatar** - User avatar with image and fallback
- **Alert** - Alert message with Title and Description
- **Table** - Data table with Header, Body, Footer, Row, Cell
- **Skeleton** - Loading skeleton placeholder

### Navigation
- **Tabs** - Tab navigation (List, Trigger, Content)
- **DropdownMenu** - Dropdown menu with all sub-options
- **ContextMenu** - Right-click context menu
- **Pagination** - Pagination controls
- **Command** - Command palette/search (with Dialog, Input, List, Empty, Group, Item)

### Feedback
- **Progress** - Progress bar
- **Accordion** - Expandable accordion (Item, Trigger, Content)
- **Tooltip** - Hover tooltip
- **Toast** - Notifications via Sonner

### Other
- **Calendar** - Date picker calendar
- **Collapsible** - Collapsible section (Trigger, Content)

## 🚀 Quick Start

### Basic Form Example
```tsx
import { Button, Input, Label, Form } from '@/components';

export default function MyForm() {
  return (
    <div className="space-y-4">
      <Label htmlFor="name">Name</Label>
      <Input id="name" placeholder="Enter your name" />
      <Button>Submit</Button>
    </div>
  );
}
```

### Using Dialog
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, Button } from '@/components';

export default function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
        {/* Dialog content here */}
      </DialogContent>
    </Dialog>
  );
}
```

### Toast Notifications
```tsx
import { toast } from 'sonner';

export default function MyComponent() {
  return (
    <button onClick={() => toast.success('Success!')}>
      Show Toast
    </button>
  );
}
```

## 🎨 Customization

All components can be styled with Tailwind CSS classes. Components use CSS variables defined in `src/app/globals.css` for theming.

### Theme Variables Available:
- `--primary` - Primary color
- `--secondary` - Secondary color
- `--success` - Success color
- `--warning` - Warning color
- `--danger` - Danger/destructive color
- `--info` - Info color
- And many more...

## 📚 Documentation

For detailed documentation and examples of each component, visit:
https://ui.shadcn.com/docs

## 🔧 Adding More Components

To add additional components from the shadCN registry:

```bash
npx shadcn@latest add [component-name]
```

Available components in registry: https://ui.shadcn.com/docs/components
