import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="date-picker" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  FileChip: ({ name, onRemove }: { name: string; onRemove: () => void }) => (
    <div data-testid="file-chip">
      <span>{name}</span>
      <button onClick={onRemove}>remove</button>
    </div>
  ),
  FileDropzone: ({
    onFiles,
    buttonLabel,
    hint,
    disabled,
  }: {
    onFiles: (files: File[]) => void;
    accept: string;
    disabled: boolean;
    buttonLabel: string;
    hint: string;
  }) => (
    <div data-testid="file-dropzone">
      <span>{buttonLabel}</span>
      <span>{hint}</span>
      <input
        type="file"
        data-testid="file-input"
        disabled={disabled}
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
    </div>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}));

import { AdditionalQuoteDetails } from './AdditionalQuoteDetails';

describe('AdditionalQuoteDetails', () => {
  const baseProps = {
    validityPeriod: '2026-12-31',
    onValidityPeriodChange: vi.fn(),
    additionalNotes: '',
    onAdditionalNotesChange: vi.fn(),
    attachments: [] as Array<{ id: string; name: string }>,
    onFileUpload: vi.fn(),
    onRemoveAttachment: vi.fn(),
    uploadError: null as string | null,
    isUploading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section heading', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.getByText('response.additionalQuoteDetails')).toBeInTheDocument();
  });

  it('renders validity period label and date picker', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.getByText('response.validityPeriod')).toBeInTheDocument();
    expect(screen.getByTestId('date-picker')).toBeInTheDocument();
  });

  it('renders additional notes label and input', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.getByText('response.additionalNotes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('response.addMessage')).toBeInTheDocument();
  });

  it('renders attachments section', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.getByText('response.attachments')).toBeInTheDocument();
    expect(screen.getByTestId('file-dropzone')).toBeInTheDocument();
  });

  it('renders file chips when attachments exist', () => {
    const props = {
      ...baseProps,
      attachments: [
        { id: '1', name: 'file1.pdf' },
        { id: '2', name: 'file2.xlsx' },
      ],
    };
    render(<AdditionalQuoteDetails {...props} />);
    expect(screen.getAllByTestId('file-chip')).toHaveLength(2);
    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.xlsx')).toBeInTheDocument();
  });

  it('does not render file chips when no attachments', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.queryByTestId('file-chip')).not.toBeInTheDocument();
  });

  it('shows upload error message when present', () => {
    render(<AdditionalQuoteDetails {...baseProps} uploadError="Upload failed" />);
    expect(screen.getByText('Upload failed')).toBeInTheDocument();
  });

  it('does not show upload error when null', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.queryByText('Upload failed')).not.toBeInTheDocument();
  });

  it('renders optional label for additional notes', () => {
    render(<AdditionalQuoteDetails {...baseProps} />);
    expect(screen.getByText('response.optional')).toBeInTheDocument();
  });
});
