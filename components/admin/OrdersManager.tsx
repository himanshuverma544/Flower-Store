'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { formatINR } from '@/lib/currency';

interface CartItemSize {
  name: string;
  stemCount?: number;
  price: number;
}

interface CartItemVase {
  id: string;
  name: string;
  price: number;
  image?: string;
}

interface CartItemAddon {
  id: string;
  name: string;
  price: number;
  icon?: string;
}

interface AdminOrderItem {
  id: string;
  slug?: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
  selectedSize?: CartItemSize;
  selectedVase?: CartItemVase;
  addons?: CartItemAddon[];
  cardMessage?: string;
  cardSender?: string;
  deliveryDate?: string;
  deliverySlot?: string;
}

interface AdminOrder {
  id: string;
  date: string;
  total: number;
  status: string;
  currentStep: number;
  estimatedDelivery: string;
  slot: string;
  recipient: {
    fullName: string;
    address: string;
    phone: string;
    apt?: string;
    city?: string;
    state?: string;
    zip?: string;
    notes?: string;
  };
  sender: {
    senderName: string;
    senderEmail: string;
    senderPhone?: string;
    keepSecret?: boolean;
  };
  cardMessage?: string;
  deliveryDate?: string;
  deliverySlot?: string;
  items: AdminOrderItem[];
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const STATUS_OPTIONS = [
  'Order Received',
  'Crafting Floral Arrangement',
  'Out for Delivery',
  'Delivered',
] as const;

export const OrdersManager: React.FC<{ user?: any }> = ({ user }) => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    totalDocs: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    all: 0,
    'Order Received': 0,
    'Crafting Floral Arrangement': 0,
    'Out for Delivery': 0,
    'Delivered': 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string>('');

  // Filters
  const [search, setSearch] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selected order for detail view
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Status update state
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', '10');
      if (search.trim()) params.set('search', search.trim());
      if (activeStatus && activeStatus !== 'all') params.set('status', activeStatus);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load orders');
      }

      setOrders(data.orders || []);
      if (data.pagination) setPagination(data.pagination);
      if (data.statusCounts) setStatusCounts(data.statusCounts);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error fetching orders');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, activeStatus, startDate, endDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchOrders();
  };

  const handleOpenDetail = (order: AdminOrder) => {
    setSelectedOrder(order);
    setTargetStatus(order.status);
    setShowConfirmModal(false);
  };

  const handleCloseDetail = () => {
    setSelectedOrder(null);
    setShowConfirmModal(false);
  };

  const handleApplyStatusUpdate = async () => {
    if (!selectedOrder || !targetStatus || targetStatus === selectedOrder.status) {
      setShowConfirmModal(false);
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrder.id,
          status: targetStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update order status');
      }

      setSuccessToast(`Order ${selectedOrder.id} status updated to "${targetStatus}"`);
      setTimeout(() => setSuccessToast(''), 4000);

      // Update selected order in-place
      setSelectedOrder(data.order);
      setShowConfirmModal(false);

      // Refresh list in background
      fetchOrders();
    } catch (err: any) {
      alert(`Error updating order: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    if (status.includes('Received') || status.includes('Verified')) {
      return {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        color: '#2563eb',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      };
    }
    if (status.includes('Crafting') || status.includes('Arranging')) {
      return {
        backgroundColor: 'rgba(234, 179, 8, 0.12)',
        color: '#ca8a04',
        border: '1px solid rgba(234, 179, 8, 0.3)',
      };
    }
    if (status.includes('Out for')) {
      return {
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        color: '#9333ea',
        border: '1px solid rgba(168, 85, 247, 0.3)',
      };
    }
    if (status.includes('Delivered')) {
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        color: '#16a34a',
        border: '1px solid rgba(34, 197, 94, 0.3)',
      };
    }
    return {
      backgroundColor: 'var(--theme-elevation-150)',
      color: 'var(--theme-elevation-800)',
      border: '1px solid var(--theme-elevation-200)',
    };
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--theme-text)' }}>
      {/* Toast banner */}
      {successToast && (
        <div
          style={{
            padding: '12px 20px',
            marginBottom: '16px',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)',
          }}
        >
          <span>✓ {successToast}</span>
          <button
            onClick={() => setSuccessToast('')}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Orders & Fulfillment
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--theme-elevation-600)' }}>
            Real-time Prisma transactional orders • Staff view for Floralux
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => fetchOrders()}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--theme-elevation-100)',
              color: 'var(--theme-elevation-900)',
              border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-50)',
          border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }} suppressHydrationWarning>
          <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by Order ID, Customer, Recipient, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              suppressHydrationWarning
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                backgroundColor: 'var(--theme-elevation-0)',
                color: 'var(--theme-text)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', whiteSpace: 'nowrap' }}>
              From:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              suppressHydrationWarning
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                backgroundColor: 'var(--theme-elevation-0)',
                color: 'var(--theme-text)',
                fontSize: '0.8125rem',
              }}
            />

            <label style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', whiteSpace: 'nowrap' }}>
              To:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              suppressHydrationWarning
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                backgroundColor: 'var(--theme-elevation-0)',
                color: 'var(--theme-text)',
                fontSize: '0.8125rem',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '9px 20px',
              backgroundColor: 'var(--theme-elevation-1000)',
              color: 'var(--theme-elevation-0)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Search
          </button>

          {(search || startDate || endDate || activeStatus !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
                setActiveStatus('all');
                setCurrentPage(1);
              }}
              style={{
                padding: '9px 14px',
                backgroundColor: 'transparent',
                color: 'var(--theme-elevation-600)',
                border: '1px dashed var(--theme-elevation-300, var(--theme-border-color))',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Reset Filters
            </button>
          )}
        </form>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Orders', count: statusCounts.all },
            { id: 'Order Received', label: 'Order Received', count: statusCounts['Order Received'] },
            { id: 'Crafting Floral Arrangement', label: 'Crafting Arrangement', count: statusCounts['Crafting Floral Arrangement'] },
            { id: 'Out for Delivery', label: 'Out for Delivery', count: statusCounts['Out for Delivery'] },
            { id: 'Delivered', label: 'Delivered', count: statusCounts['Delivered'] },
          ].map((tab) => {
            const isSelected = activeStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveStatus(tab.id);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isSelected
                    ? '1px solid var(--theme-elevation-1000)'
                    : '1px solid var(--theme-elevation-200, var(--theme-border-color))',
                  backgroundColor: isSelected ? 'var(--theme-elevation-1000)' : 'var(--theme-elevation-0)',
                  color: isSelected ? 'var(--theme-elevation-0)' : 'var(--theme-elevation-800)',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.6875rem',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--theme-elevation-150)',
                  }}
                >
                  {tab.count || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div
        style={{
          backgroundColor: 'var(--theme-elevation-0)',
          border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--theme-elevation-500)', fontSize: '0.875rem' }}>
            Loading orders from PostgreSQL...
          </div>
        ) : errorMessage ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444', fontSize: '0.875rem' }}>
            ⚠️ {errorMessage}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--theme-elevation-500)' }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '8px' }}>📦 No Orders Found</div>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              No orders matched your search or status filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--theme-elevation-50)',
                    borderBottom: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                    color: 'var(--theme-elevation-600)',
                    fontWeight: 600,
                  }}
                >
                  <th style={{ padding: '14px 16px' }}>Order ID</th>
                  <th style={{ padding: '14px 16px' }}>Date</th>
                  <th style={{ padding: '14px 16px' }}>Recipient</th>
                  <th style={{ padding: '14px 16px' }}>Sender</th>
                  <th style={{ padding: '14px 16px' }}>Items</th>
                  <th style={{ padding: '14px 16px' }}>Total Amount</th>
                  <th style={{ padding: '14px 16px' }}>Delivery Status</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const badgeStyle = getStatusBadgeStyle(order.status);
                  const firstItem = order.items?.[0];
                  const extraItemsCount = (order.items?.length || 1) - 1;

                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: '1px solid var(--theme-elevation-100, var(--theme-border-color))',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                        <span style={{ color: 'var(--theme-elevation-900)' }}>{order.id}</span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--theme-elevation-600)' }}>
                        {order.date || new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--theme-elevation-900)' }}>
                          {order.recipient?.fullName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
                          {order.recipient?.city || 'India'}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: 'var(--theme-elevation-800)' }}>
                          {order.sender?.keepSecret ? '🤫 Anonymous Gifter' : order.sender?.senderName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
                          {order.sender?.senderEmail}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--theme-elevation-700)' }}>
                        {firstItem ? (
                          <div>
                            <span style={{ fontWeight: 500 }}>{firstItem.name}</span>
                            {extraItemsCount > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', marginLeft: '4px' }}>
                                +{extraItemsCount} more
                              </span>
                            )}
                          </div>
                        ) : (
                          '1 Bouquet'
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--theme-elevation-900)' }}>
                        {formatINR(order.total)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            ...badgeStyle,
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-block',
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDetail(order)}
                          style={{
                            padding: '6px 14px',
                            backgroundColor: 'var(--theme-elevation-100)',
                            color: 'var(--theme-elevation-900)',
                            border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          View & Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--theme-elevation-50)',
            borderTop: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--theme-elevation-600)',
          }}
        >
          <div>
            Showing {(pagination.page - 1) * pagination.limit + (orders.length > 0 ? 1 : 0)} -{' '}
            {(pagination.page - 1) * pagination.limit + orders.length} of {pagination.totalDocs} orders
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={!pagination.hasPrevPage}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                backgroundColor: pagination.hasPrevPage ? 'var(--theme-elevation-0)' : 'transparent',
                color: pagination.hasPrevPage ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-400)',
                cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed',
              }}
            >
              Previous
            </button>
            <span style={{ alignSelf: 'center', fontWeight: 600, padding: '0 4px' }}>
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              disabled={!pagination.hasNextPage}
              onClick={() => setCurrentPage((p) => p + 1)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                backgroundColor: pagination.hasNextPage ? 'var(--theme-elevation-0)' : 'transparent',
                color: pagination.hasNextPage ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-400)',
                cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed',
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--theme-elevation-0)',
              borderRadius: '16px',
              border: '1px solid var(--theme-elevation-200, var(--theme-border-color))',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              color: 'var(--theme-text)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                backgroundColor: 'var(--theme-elevation-0)',
                zIndex: 10,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                    Order #{selectedOrder.id}
                  </h2>
                  <span
                    style={{
                      ...getStatusBadgeStyle(selectedOrder.status),
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                    }}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', marginTop: '4px' }}>
                  Placed on {selectedOrder.date || new Date(selectedOrder.createdAt).toLocaleDateString()}
                </div>
              </div>

              <button
                onClick={handleCloseDetail}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: 'var(--theme-elevation-500)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Delivery Status Update Section */}
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--theme-elevation-50)',
                  border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                  borderRadius: '12px',
                }}
              >
                <h3 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--theme-elevation-900)' }}>
                  Delivery Status Workflow
                </h3>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: 'var(--theme-elevation-600)' }}>
                  Updating status synchronizes customer order tracking at <code>/track-order?id={selectedOrder.id}</code> in real time.
                </p>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--theme-elevation-250, var(--theme-border-color))',
                      backgroundColor: 'var(--theme-elevation-0)',
                      color: 'var(--theme-text)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      minWidth: '240px',
                    }}
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={targetStatus === selectedOrder.status || isUpdatingStatus}
                    onClick={() => setShowConfirmModal(true)}
                    style={{
                      padding: '8px 20px',
                      backgroundColor:
                        targetStatus === selectedOrder.status ? 'var(--theme-elevation-200)' : '#16a34a',
                      color: targetStatus === selectedOrder.status ? 'var(--theme-elevation-500)' : '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: targetStatus === selectedOrder.status ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Apply Status Update'}
                  </button>
                </div>

                {/* Confirmation Box */}
                {showConfirmModal && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(234, 179, 8, 0.12)',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      borderRadius: '8px',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#ca8a04', marginBottom: '4px' }}>
                      ⚠️ Confirm Delivery Status Update
                    </div>
                    <div style={{ color: 'var(--theme-text)', marginBottom: '10px' }}>
                      Change Order <strong>#{selectedOrder.id}</strong> from{' '}
                      <em>"{selectedOrder.status}"</em> to <strong>"{targetStatus}"</strong>?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleApplyStatusUpdate}
                        disabled={isUpdatingStatus}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {isUpdatingStatus ? 'Saving...' : 'Yes, Update Status'}
                      </button>
                      <button
                        onClick={() => setShowConfirmModal(false)}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: 'var(--theme-elevation-100)',
                          color: 'var(--theme-elevation-800)',
                          border: '1px solid var(--theme-elevation-200)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Recipient and Sender Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Recipient Details */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                    backgroundColor: 'var(--theme-elevation-50)',
                  }}
                >
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-elevation-600)' }}>
                    Recipient Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8125rem' }}>
                    <div>
                      <strong>Name:</strong> {selectedOrder.recipient?.fullName}
                    </div>
                    <div>
                      <strong>Phone:</strong> {selectedOrder.recipient?.phone || 'Not provided'}
                    </div>
                    <div>
                      <strong>Address:</strong> {selectedOrder.recipient?.address}
                      {selectedOrder.recipient?.apt ? `, ${selectedOrder.recipient?.apt}` : ''}
                    </div>
                    <div>
                      <strong>City / State:</strong> {selectedOrder.recipient?.city || '—'}, {selectedOrder.recipient?.state || '—'} {selectedOrder.recipient?.zip}
                    </div>
                    {selectedOrder.recipient?.notes && (
                      <div style={{ marginTop: '4px', color: '#b45309' }}>
                        <strong>Delivery Notes:</strong> {selectedOrder.recipient?.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sender Details */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                    backgroundColor: 'var(--theme-elevation-50)',
                  }}
                >
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-elevation-600)' }}>
                    Customer / Gifter Details
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8125rem' }}>
                    <div>
                      <strong>Name:</strong> {selectedOrder.sender?.senderName}
                      {selectedOrder.sender?.keepSecret && (
                        <span style={{ marginLeft: '6px', fontSize: '0.6875rem', color: '#9333ea', fontWeight: 600 }}>
                          (Requested Anonymous Gift)
                        </span>
                      )}
                    </div>
                    <div>
                      <strong>Email:</strong> {selectedOrder.sender?.senderEmail || '—'}
                    </div>
                    <div>
                      <strong>Phone:</strong> {selectedOrder.sender?.senderPhone || '—'}
                    </div>
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--theme-elevation-200)' }}>
                      <strong>Delivery Target:</strong> {selectedOrder.estimatedDelivery || selectedOrder.deliveryDate || 'Tomorrow'}
                    </div>
                    <div>
                      <strong>Time Slot:</strong> {selectedOrder.slot || selectedOrder.deliverySlot || 'Morning Window'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hand-lettered Greeting Card Message */}
              {selectedOrder.cardMessage && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#b45309' }}>
                    💌 Letterpress Sentiment Card
                  </h4>
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.875rem', color: 'var(--theme-text)', lineHeight: 1.5 }}>
                    "{selectedOrder.cardMessage}"
                  </p>
                </div>
              )}

              {/* Ordered Items Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: 700, color: 'var(--theme-elevation-900)' }}>
                  Ordered Floral Items ({selectedOrder.items?.length || 0})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedOrder.items?.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '14px',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                        backgroundColor: 'var(--theme-elevation-50)',
                        alignItems: 'center',
                      }}
                    >
                      {item.image && (
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            position: 'relative',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: 'var(--theme-elevation-100)',
                            flexShrink: 0,
                          }}
                        >
                          <Image src={item.image} alt={item.name} fill style={{ objectFit: 'cover' }} />
                        </div>
                      )}

                      <div style={{ flex: 1, fontSize: '0.8125rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--theme-elevation-900)' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', marginTop: '2px' }}>
                          Size: {item.selectedSize?.name || 'Signature'}
                          {item.selectedSize?.stemCount ? ` (${item.selectedSize.stemCount} stems)` : ''} • Qty: {item.quantity || 1}
                        </div>
                        {item.selectedVase && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)', marginTop: '2px' }}>
                            Vase: {item.selectedVase.name} ({formatINR(item.selectedVase.price)})
                          </div>
                        )}
                        {item.addons && item.addons.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)', marginTop: '2px' }}>
                            Add-ons: {item.addons.map((a) => `${a.name} (${formatINR(a.price)})`).join(', ')}
                          </div>
                        )}
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--theme-elevation-900)' }}>
                        {formatINR(item.price * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--theme-elevation-100)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
                    Payment Summary
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--theme-elevation-700)' }}>
                    Storefront Verified Checkout (INR)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
                    Total Charged
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--theme-elevation-1000)' }}>
                    {formatINR(selectedOrder.total)}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--theme-elevation-150, var(--theme-border-color))',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--theme-elevation-50)',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
              }}
            >
              <button
                onClick={handleCloseDetail}
                style={{
                  padding: '8px 20px',
                  backgroundColor: 'var(--theme-elevation-1000)',
                  color: 'var(--theme-elevation-0)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
