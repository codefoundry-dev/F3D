import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateExtraction = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockDocExtractionQuery = vi.hoisted(() => vi.fn());
const mockUseProjects = vi.hoisted(() => vi.fn());
const mockUseCreateBom = vi.hoisted(() => vi.fn());
const mockConfirmDocExtraction = vi.hoisted(() => vi.fn());
const mockListSpreadsheetSheets = vi.hoisted(() => vi.fn());
const mockNotify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => (o?.returnObjects ? ['Col A', 'Col B'] : k),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'proj-1' }),
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { projectDetail: '/projects/:id', projectsNew: '/projects/new' },
}));

vi.mock('@forethread/po-shared', () => ({
  Stepper: (p: any) => <div data-testid="stepper">{p.step}</div>,
}));

vi.mock('@forethread/shared-types/client', () => ({
  isBomExtractionResult: () => true,
}));

vi.mock('@forethread/api-client', () => ({
  confirmDocExtraction: mockConfirmDocExtraction,
  listSpreadsheetSheets: mockListSpreadsheetSheets,
}));

vi.mock('@/features/doc-intelligence/hooks/useDocExtraction', () => ({
  useCreateDocExtraction: () => mockCreateExtraction(),
  useDocExtractionQuery: () => mockDocExtractionQuery(),
}));

vi.mock('@/features/projects/services/projects.service', () => ({
  useProjects: () => mockUseProjects(),
}));

vi.mock('../hooks/useBoms', () => ({
  useCreateBom: () => mockUseCreateBom(),
}));

vi.mock('../components/create/BomReviewStep', () => ({
  BomReviewStep: (_p: any) => <div data-testid="bom-review-step" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button
      onClick={p.onClick}
      disabled={!!p.disabled || !!p.isLoading}
      {...(p['data-testid'] ? { 'data-testid': p['data-testid'] } : {})}
    >
      {p.children}
    </button>
  ),
  Input: (p: any) => (
    <input
      value={p.value}
      onChange={p.onChange}
      placeholder={p.placeholder}
      data-testid={p['data-testid']}
    />
  ),
  Modal: (p: any) => <div data-testid="modal">{p.children}</div>,
  RadioButton: (p: any) => <input type="radio" checked={p.checked} onChange={p.onChange} />,
  Checkbox: (p: any) => (
    <input
      type="checkbox"
      aria-label={p.label}
      checked={p.checked}
      onChange={(e) => p.onChange(e.target.checked)}
    />
  ),
  Spinner: () => <div data-testid="spinner" />,
  notificationService: mockNotify,
}));

import CreateBomPage from './CreateBomPage';

const PROJECTS = {
  data: { items: [{ id: 'proj-1', name: 'Alpha', description: 'd' }] },
};

describe('CreateBomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateExtraction.mockReturnValue({
      mutate: (vars: any, opts: any) => {
        mockMutate(vars);
        opts.onSuccess({ id: 'ext-1' });
      },
      isPending: false,
    });
    // Default: single-sheet / non-spreadsheet — no picker.
    mockListSpreadsheetSheets.mockResolvedValue([]);
    mockDocExtractionQuery.mockReturnValue({ data: undefined });
    mockUseProjects.mockReturnValue(PROJECTS);
    mockUseCreateBom.mockReturnValue({
      mutate: (_vars: any, opts: any) => opts.onSuccess(),
      isPending: false,
    });
    mockConfirmDocExtraction.mockResolvedValue(undefined);
  });

  // ── Step 1: upload ────────────────────────────────────────────────────────

  it('renders the stepper and the step-1 upload card', () => {
    render(<CreateBomPage />);
    expect(screen.getByTestId('stepper')).toBeInTheDocument();
    expect(screen.getByText('create.step1Title')).toBeInTheDocument();
    expect(screen.getByText('create.uploadCardTitle')).toBeInTheDocument();
    expect(screen.getByTestId('bom-dropzone')).toBeInTheDocument();
  });

  it('renders the required-columns list from the returnObjects translation', () => {
    render(<CreateBomPage />);
    expect(screen.getByText('Col A')).toBeInTheDocument();
    expect(screen.getByText('Col B')).toBeInTheDocument();
  });

  it('disables proceed until a file is selected', () => {
    render(<CreateBomPage />);
    expect(screen.getByTestId('bom-proceed')).toBeDisabled();
  });

  it('selecting a file shows the file name and enables proceed', () => {
    const { container } = render(<CreateBomPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'bom.xlsx', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByTestId('bom-file-name')).toHaveTextContent('bom.xlsx');
    expect(screen.getByTestId('bom-proceed')).not.toBeDisabled();
  });

  it('removes the selected file', () => {
    const { container } = render(<CreateBomPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    expect(screen.getByTestId('bom-file-name')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('bom-remove-file'));
    expect(screen.queryByTestId('bom-file-name')).not.toBeInTheDocument();
  });

  it('clicking the dropzone opens the hidden file input', () => {
    const { container } = render(<CreateBomPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('bom-dropzone'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('dropping a file selects it', () => {
    render(<CreateBomPage />);
    const file = new File(['x'], 'dropped.csv');
    fireEvent.drop(screen.getByTestId('bom-dropzone'), { dataTransfer: { files: [file] } });
    expect(screen.getByTestId('bom-file-name')).toHaveTextContent('dropped.csv');
  });

  it('drag over then leave toggles without crashing', () => {
    render(<CreateBomPage />);
    const zone = screen.getByTestId('bom-dropzone');
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    expect(zone).toBeInTheDocument();
  });

  it('proceeding from step 1 starts extraction and shows the processing card', () => {
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    expect(screen.getByText('create.processingTitle')).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('notifies on extraction start error', () => {
    mockCreateExtraction.mockReturnValue({
      mutate: (_vars: any, opts: any) => opts.onError(),
      isPending: false,
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    expect(mockNotify.error).toHaveBeenCalledWith('create.uploadError');
  });

  // ── Sheet picker (multi-sheet workbooks) ────────────────────────────────────

  it('does not show a sheet picker for a single-sheet workbook', async () => {
    mockListSpreadsheetSheets.mockResolvedValue(['OnlySheet']);
    const { container } = render(<CreateBomPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    await waitFor(() => expect(mockListSpreadsheetSheets).toHaveBeenCalled());
    expect(screen.queryByTestId('bom-sheet-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('bom-proceed')).not.toBeDisabled();
  });

  it('does not inspect sheets for a non-xlsx file', async () => {
    render(<CreateBomPage />);
    fireEvent.drop(screen.getByTestId('bom-dropzone'), {
      dataTransfer: { files: [new File(['x'], 'bom.csv')] },
    });
    expect(mockListSpreadsheetSheets).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bom-sheet-picker')).not.toBeInTheDocument();
  });

  it('shows a sheet picker for a multi-sheet workbook and extracts only the selected sheets', async () => {
    mockListSpreadsheetSheets.mockResolvedValue(['Sheet1', 'HDPE']);
    const { container } = render(<CreateBomPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });

    await screen.findByTestId('bom-sheet-picker');

    // Deselect the scratch sheet, keep the real BOM tab.
    fireEvent.click(screen.getByLabelText('Sheet1'));
    fireEvent.click(screen.getByTestId('bom-proceed'));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'BOM', sheetNames: ['HDPE'] }),
    );
  });

  it('disables proceed when every sheet is deselected', async () => {
    mockListSpreadsheetSheets.mockResolvedValue(['Sheet1', 'HDPE']);
    const { container } = render(<CreateBomPage />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });

    await screen.findByTestId('bom-sheet-picker');
    fireEvent.click(screen.getByLabelText('Sheet1'));
    fireEvent.click(screen.getByLabelText('HDPE'));

    expect(screen.getByTestId('bom-proceed')).toBeDisabled();
  });

  // ── Failed card ─────────────────────────────────────────────────────────────

  it('shows the failed card when the extraction status is FAILED', () => {
    mockDocExtractionQuery.mockReturnValue({ data: { status: 'FAILED' } });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    expect(screen.getByText('create.failedTitle')).toBeInTheDocument();
    expect(screen.getByTestId('bom-try-again')).toBeInTheDocument();
  });

  it('try-again on the failed card restarts extraction', () => {
    mockDocExtractionQuery.mockReturnValue({ data: { status: 'FAILED' } });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    // back on the failed card; try-again calls startExtraction again
    fireEvent.click(screen.getByTestId('bom-try-again'));
    expect(screen.getByText('create.failedTitle')).toBeInTheDocument();
  });

  it('cancel on the failed card returns to the upload step', () => {
    mockDocExtractionQuery.mockReturnValue({ data: { status: 'FAILED' } });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    fireEvent.click(screen.getByText('create.cancel'));
    expect(screen.getByText('create.uploadCardTitle')).toBeInTheDocument();
  });

  // ── Step 2: review ────────────────────────────────────────────────────────

  it('advances to step 2 when the extraction completes', () => {
    mockDocExtractionQuery.mockReturnValue({
      data: { status: 'COMPLETED', editedResult: { items: [] } },
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    expect(screen.getByText('create.step2Title')).toBeInTheDocument();
    expect(screen.getByTestId('bom-review-step')).toBeInTheDocument();
  });

  it('disables continue on step 2 when there are no real rows', () => {
    mockDocExtractionQuery.mockReturnValue({
      data: { status: 'COMPLETED', editedResult: { items: [] } },
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    const continueBtn = screen.getByTestId('bom-continue');
    // No real rows -> disabled; label stays "continue" because unmatched is 0.
    expect(continueBtn).toBeDisabled();
    expect(continueBtn).toHaveTextContent('create.continue');
  });

  it('disables continue and shows matchItemsFirst when a real row is unmatched', () => {
    mockDocExtractionQuery.mockReturnValue({
      data: {
        status: 'COMPLETED',
        editedResult: {
          items: [
            {
              description: 'Steel',
              quantity: 5,
              unit: 'unit',
              matchedMaterialId: null,
              matchedMaterialName: null,
              matchConfidence: null,
              matchCandidates: [],
            },
          ],
        },
      },
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    const continueBtn = screen.getByTestId('bom-continue');
    expect(continueBtn).toBeDisabled();
    expect(continueBtn).toHaveTextContent('create.matchItemsFirst');
  });

  it('auto-accepts a suggested match so continue is enabled on step 2', () => {
    mockDocExtractionQuery.mockReturnValue({
      data: {
        status: 'COMPLETED',
        editedResult: {
          items: [
            {
              description: '90 bend',
              quantity: 10,
              unit: 'unit',
              // A below-threshold suggestion (no confirmed match) is accepted by
              // default, so the row is matched and the wizard can proceed.
              matchedMaterialId: null,
              matchedMaterialName: null,
              matchConfidence: null,
              matchCandidates: [
                {
                  materialId: 'm-bend',
                  name: '12B Bend 90',
                  confidence: 0.62,
                  category: 'Fittings',
                  subCategory: 'Bends',
                },
              ],
            },
          ],
        },
      },
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    const continueBtn = screen.getByTestId('bom-continue');
    expect(continueBtn).not.toBeDisabled();
    expect(continueBtn).toHaveTextContent('create.continue');
  });

  it('advances to step 3 from step 2 when rows are matched', () => {
    mockDocExtractionQuery.mockReturnValue({
      data: {
        status: 'COMPLETED',
        editedResult: {
          items: [
            {
              description: 'Steel',
              quantity: 5,
              unit: 'unit',
              matchedMaterialId: 'm1',
              matchedMaterialName: 'Steel Bar',
              matchConfidence: 0.9,
              matchCandidates: [],
            },
          ],
        },
      },
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    const continueBtn = screen.getByTestId('bom-continue');
    expect(continueBtn).not.toBeDisabled();
    expect(continueBtn).toHaveTextContent('create.continue');
    fireEvent.click(continueBtn);
    expect(screen.getByText('create.step3Title')).toBeInTheDocument();
  });

  // ── Step 3: assign project + create ─────────────────────────────────────────

  function gotoStep3() {
    mockDocExtractionQuery.mockReturnValue({
      data: {
        status: 'COMPLETED',
        editedResult: {
          items: [
            {
              description: 'Steel',
              quantity: 5,
              unit: 'unit',
              matchedMaterialId: 'm1',
              matchedMaterialName: 'Steel Bar',
              matchConfidence: 0.9,
              matchCandidates: [],
            },
          ],
        },
      },
    });
    render(<CreateBomPage />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'bom.xlsx')] } });
    fireEvent.click(screen.getByTestId('bom-proceed'));
    fireEvent.click(screen.getByTestId('bom-continue'));
  }

  it('renders the project list on step 3', () => {
    gotoStep3();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByTestId('bom-project-proj-1')).toBeInTheDocument();
  });

  it('filters the project list by the search box', () => {
    gotoStep3();
    fireEvent.change(screen.getByTestId('bom-project-search'), { target: { value: 'zzz' } });
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('create.noProjects')).toBeInTheDocument();
  });

  it('keeps matching projects when the search term matches', () => {
    gotoStep3();
    fireEvent.change(screen.getByTestId('bom-project-search'), { target: { value: 'alph' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('opens a new project tab from the create-new-project button', () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    gotoStep3();
    fireEvent.click(screen.getByText('create.createNewProject'));
    expect(openSpy).toHaveBeenCalledWith('/projects/new', '_blank', 'noopener');
    openSpy.mockRestore();
  });

  it('creates the BOM and shows the success modal, then confirms the extraction', async () => {
    gotoStep3();
    // proj-1 is already selected from the route param; create is enabled
    const createBtn = screen.getByTestId('bom-create');
    expect(createBtn).not.toBeDisabled();
    fireEvent.click(createBtn);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('create.successTitle')).toBeInTheDocument();
    await waitFor(() =>
      expect(mockConfirmDocExtraction).toHaveBeenCalledWith('ext-1', expect.anything()),
    );
  });

  it('navigates to the BOM tab from the success modal view button', () => {
    gotoStep3();
    fireEvent.click(screen.getByTestId('bom-create'));
    fireEvent.click(screen.getByTestId('bom-success-view'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1?tab=bom');
  });

  it('navigates back to the project from the success modal back button', () => {
    gotoStep3();
    fireEvent.click(screen.getByTestId('bom-create'));
    fireEvent.click(screen.getByText('create.backToProject'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1');
  });

  it('notifies on create-bom error', () => {
    mockUseCreateBom.mockReturnValue({
      mutate: (_vars: any, opts: any) => opts.onError(),
      isPending: false,
    });
    gotoStep3();
    fireEvent.click(screen.getByTestId('bom-create'));
    expect(mockNotify.error).toHaveBeenCalledWith('create.createError');
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('exits to the project when cancel in the footer is clicked', () => {
    render(<CreateBomPage />);
    fireEvent.click(screen.getByText('create.cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1?tab=bom');
  });
});
