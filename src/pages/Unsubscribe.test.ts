import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderUnsubscribe, renderUnsubscribeComplete, cleanupUnsubscribeTimer } from '../pages/Unsubscribe';
import liff from '@line/liff';

// Mock @line/liff
vi.mock('@line/liff', () => ({
  default: {
    isLoggedIn: vi.fn(),
    logout: vi.fn(),
  },
}));

// Mock marked and dompurify
vi.mock('marked', () => ({
  marked: {
    parse: vi.fn().mockResolvedValue('<p>Mock Unsubscribe Content</p>'),
  },
}));

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => html),
  },
}));

describe('Unsubscribe Page', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Suppress console.error for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup global fetch
    global.fetch = vi.fn();
    
    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
    cleanupUnsubscribeTimer();
  });

  describe('renderUnsubscribe', () => {
    it('renders unsubscribe content', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('Mock Unsubscribe Content');
      expect(container.querySelector('#unsubscribe-btn')).toBeInTheDocument();
      expect(container.querySelector('#back-btn')).toBeInTheDocument();
    });

    it('handles back button', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const backSpy = vi.spyOn(window.history, 'back');
      const backBtn = container.querySelector('#back-btn') as HTMLButtonElement;
      backBtn.click();

      expect(backSpy).toHaveBeenCalled();
    });

    it('handles unsubscribe button (navigation to complete)', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# Unsubscribe Info'),
      });

      await renderUnsubscribe(container);

      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      const unsubscribeBtn = container.querySelector('#unsubscribe-btn') as HTMLButtonElement;
      unsubscribeBtn.click();

      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/unsubscribe/complete');
    });

    it('shows error on fetch failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
      });

      await renderUnsubscribe(container);

      expect(container.innerHTML).toContain('ページの表示中にエラーが発生しました');
    });
  });

  describe('renderUnsubscribeComplete', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      (liff.isLoggedIn as any).mockReturnValue(true);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders completion message and countdown', () => {
      renderUnsubscribeComplete(container);

      expect(container.innerHTML).toContain('退会が完了しました');
      expect(container.innerHTML).toContain('3'); // Initial countdown
    });

    it('counts down and logs out', () => {
      renderUnsubscribeComplete(container);

      // Advance 1 second
      vi.advanceTimersByTime(1000);
      expect(container.innerHTML).toContain('2');

      // Advance 1 second
      vi.advanceTimersByTime(1000);
      expect(container.innerHTML).toContain('1');

      // Advance 1 second (total 3) -> should trigger logout
      vi.advanceTimersByTime(1000);
      
      expect(liff.logout).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });

    it('cleans up timer on manual cleanup', () => {
      renderUnsubscribeComplete(container);
      
      cleanupUnsubscribeTimer();
      
      // Advance time, nothing should happen
      vi.advanceTimersByTime(3000);
      
      expect(liff.logout).not.toHaveBeenCalled();
    });
  });
});
