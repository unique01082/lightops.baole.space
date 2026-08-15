import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolStepFrame, ToolWorkflowShell } from './tool-workflow-shell';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ToolWorkflowShell', () => {
  it('renders an accessible guided workflow and delegates navigation', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onStepChange = vi.fn();

    render(
      <ToolWorkflowShell
        toolId="resize"
        steps={[
          { id: 'images', label: 'Images', description: 'Choose files', complete: true },
          { id: 'settings', label: 'Settings', description: 'Set dimensions' },
          { id: 'review', label: 'Review', description: 'Check the batch', disabled: true },
        ]}
        activeStep="settings"
        statusLabel="Ready"
        onBack={onBack}
        onStepChange={onStepChange}
      >
        <div>Workspace content</div>
      </ToolWorkflowShell>,
    );

    expect(screen.getByRole('button', { name: /Settings/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: /Review/ })).toBeDisabled();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
    expect(screen.getByText('Workspace content').closest('main')?.parentElement).toHaveClass(
      'overflow-hidden',
    );
    expect(screen.getByRole('complementary')).toHaveClass('min-[1040px]:w-52');

    await user.click(screen.getByRole('button', { name: 'toolWorkflow.back' }));
    expect(onBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: /Images/ }));
    expect(onStepChange).toHaveBeenCalledWith('images');
  });

  it('keeps the stage body scrollable and the footer fixed', () => {
    render(
      <ToolStepFrame
        eyebrow="01 / Prepare"
        title="Build the batch"
        description="Bring the selects onto the light table."
        stats={[{ label: 'Frames', value: '24' }]}
        footer={<button type="button">Continue</button>}
      >
        <div>Stage body</div>
      </ToolStepFrame>,
    );

    expect(screen.getByTestId('tool-step-scroll')).toHaveClass('overflow-y-auto');
    expect(screen.getByTestId('tool-step-footer')).toHaveClass('shrink-0');
    expect(screen.getByText('Stage body').closest('section')).toHaveClass('tool-step-enter');
    expect(screen.getByText('24')).toBeInTheDocument();
  });
});
