import { render, screen, fireEvent } from '@testing-library/react';

const mockMaterials = vi.hoisted(() => ({
  value: {
    items: [] as Array<{
      id: string;
      name: string;
      unitOfMeasure: string;
      categoryName?: string;
      description?: string;
    }>,
  },
}));

const mockCategories = vi.hoisted(() => ({
  value: [] as Array<{ id: string; name: string }>,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && 'count' in params) return `${key} ${Number(params.count)}`;
      return key;
    },
  }),
}));

vi.mock('@forethread/api-client', () => ({
  getMaterials: vi.fn(() => Promise.resolve(mockMaterials.value)),
  getMaterialCategories: vi.fn(() => Promise.resolve(mockCategories.value)),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  CustomDropdown: ({
    value,
    onChange,
    placeholder,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
  }) => (
    <select
      data-testid="category-dropdown"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
    </select>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/filter.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'material-categories') {
      return { data: mockCategories.value };
    }
    return { data: mockMaterials.value };
  },
}));

import { MaterialSearchPopup } from './MaterialSearchPopup';

describe('MaterialSearchPopup', () => {
  const onClose = vi.fn();
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMaterials.value = { items: [] };
    mockCategories.value = [];
    // Force desktop mode
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('returns null when not open', () => {
    const { container } = render(
      <MaterialSearchPopup open={false} onClose={onClose} onSelect={onSelect} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders results count and filters button when open', () => {
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText('response.filters')).toBeInTheDocument();
  });

  it('shows "No materials found" when empty', () => {
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText('No materials found')).toBeInTheDocument();
  });

  it('renders material items when data is available', () => {
    mockMaterials.value = {
      items: [
        { id: 'm-1', name: 'Steel Beam', unitOfMeasure: 'pcs', categoryName: 'Metal' },
        { id: 'm-2', name: 'Copper Wire', unitOfMeasure: 'm' },
      ],
    };
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('Copper Wire')).toBeInTheDocument();
    expect(screen.getByText('pcs')).toBeInTheDocument();
  });

  it('shows category badge for materials with categoryName', () => {
    mockMaterials.value = {
      items: [{ id: 'm-1', name: 'Steel Beam', unitOfMeasure: 'pcs', categoryName: 'Metal' }],
    };
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    expect(screen.getByTestId('badge')).toHaveTextContent('Metal');
  });

  it('calls onSelect and close when a material is clicked', () => {
    const material = { id: 'm-1', name: 'Steel Beam', unitOfMeasure: 'pcs' };
    mockMaterials.value = { items: [material] };
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Steel Beam'));
    expect(onSelect).toHaveBeenCalledWith(material);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles filter panel on click', () => {
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('response.filters'));
    expect(screen.getByText('response.filterByCategory')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    render(<MaterialSearchPopup open onClose={onClose} onSelect={onSelect} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
