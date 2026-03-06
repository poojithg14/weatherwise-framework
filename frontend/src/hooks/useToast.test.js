import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast with default type', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.addToast('Hello'); });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello');
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('adds a toast with custom type', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.addToast('Error!', { type: 'error' }); });
    expect(result.current.toasts[0].type).toBe('error');
  });

  it('removes a toast manually', () => {
    const { result } = renderHook(() => useToast());
    let id;
    act(() => { id = result.current.addToast('Test', { duration: 0 }); });
    expect(result.current.toasts).toHaveLength(1);
    act(() => { result.current.removeToast(id); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-dismisses after duration', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.addToast('Temporary', { duration: 3000 }); });
    expect(result.current.toasts).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports multiple toasts', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('First', { duration: 0 });
      result.current.addToast('Second', { duration: 0 });
      result.current.addToast('Third', { duration: 0 });
    });
    expect(result.current.toasts).toHaveLength(3);
  });
});
