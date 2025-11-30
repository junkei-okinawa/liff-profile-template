import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderProfile } from '../pages/Profile';
import liff from '@line/liff';

// Mock @line/liff
vi.mock('@line/liff', () => ({
  default: {
    isInClient: vi.fn(),
    isLoggedIn: vi.fn(),
    getProfile: vi.fn(),
    getAppLanguage: vi.fn(),
    getOS: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('Profile Page', () => {
  let container: HTMLElement;
  const mockProfile = {
    displayName: 'Test User',
    userId: 'U1234567890',
    pictureUrl: 'https://example.com/avatar.png',
    statusMessage: 'Hello World',
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Suppress console.error for expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Default LIFF mock setup
    (liff.isInClient as any).mockReturnValue(true);
    (liff.isLoggedIn as any).mockReturnValue(true);
    (liff.getProfile as any).mockResolvedValue(mockProfile);
    (liff.getAppLanguage as any).mockReturnValue('ja');
    (liff.getOS as any).mockReturnValue('web');
    
    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders profile with full information', async () => {
    await renderProfile(container);

    // Check basic info
    expect(container.innerHTML).toContain('Test User');
    expect(container.innerHTML).toContain('Hello World');
    expect(container.innerHTML).toContain('U1234567890');
    
    // Check image
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
    
    // Check system info
    expect(container.innerHTML).toContain('ja');
    expect(container.innerHTML).toContain('web');
  });

  it('renders profile without optional information', async () => {
    (liff.getProfile as any).mockResolvedValue({
      displayName: 'No Image User',
      userId: 'U999',
    });

    await renderProfile(container);

    expect(container.innerHTML).toContain('No Image User');
    expect(container.innerHTML).toContain('U999');
    
    // Check fallback image
    const img = container.querySelector('img');
    expect(img).not.toBeInTheDocument();
    expect(container.innerHTML).toContain('?'); // Fallback text
  });

  it('escapes HTML in profile data (XSS prevention)', async () => {
    (liff.getProfile as any).mockResolvedValue({
      displayName: '<script>alert(1)</script>',
      userId: 'U123',
      statusMessage: '<b>Bold</b>',
    });

    await renderProfile(container);

    expect(container.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(container.innerHTML).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });

  it('handles logout', async () => {
    await renderProfile(container);

    const logoutBtn = container.querySelector('#logout-btn') as HTMLButtonElement;
    expect(logoutBtn).toBeInTheDocument();

    logoutBtn.click();

    expect(liff.logout).toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('handles navigation links', async () => {
    await renderProfile(container);

    // Mock pushState
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Terms link
    const termsLink = container.querySelector('a[href="/terms-of-use"]') as HTMLAnchorElement;
    termsLink.click();
    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/terms-of-use');
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));

    // Unsubscribe link
    const unsubscribeLink = container.querySelector('a[href="/unsubscribe"]') as HTMLAnchorElement;
    unsubscribeLink.click();
    expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/unsubscribe');
  });

  it('shows error when not logged in', async () => {
    (liff.isInClient as any).mockReturnValue(false);
    (liff.isLoggedIn as any).mockReturnValue(false);

    await renderProfile(container);

    expect(container.innerHTML).toContain('プロフィールの読み込みに失敗しました');
  });

  it('shows error when getProfile fails', async () => {
    (liff.getProfile as any).mockRejectedValue(new Error('Network error'));

    await renderProfile(container);

    expect(container.innerHTML).toContain('プロフィールの読み込みに失敗しました');
  });
});
