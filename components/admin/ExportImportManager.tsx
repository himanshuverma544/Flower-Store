'use client';

import React, { useState, useEffect, useRef } from 'react';
import type {
  ExportPackage,
  ImportMode,
  ImportOptions,
  PreviewSummary,
  ImportResult,
} from '@/lib/export-import/types';

interface ExportImportManagerProps {
  user?: any;
}

interface EnvInfo {
  environment: string;
  environmentLabel?: string;
  isProduction: boolean;
  maskedHost: string;
  r2Bucket: string;
  dbName: string;
}

interface DbCounts {
  media: number;
  categories: number;
  addons: number;
  coupons: number;
  orders: number;
  products: number;
  siteSettings: number;
}

export const ExportImportManager: React.FC<ExportImportManagerProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null);
  const [dbCounts, setDbCounts] = useState<DbCounts | null>(null);
  const [loadingEnv, setLoadingEnv] = useState<boolean>(true);

  // ---------------------------------------------------------------------------
  // Export State
  // ---------------------------------------------------------------------------
  const [exportSelections, setExportSelections] = useState({
    products: true,
    categories: true,
    addons: true,
    coupons: true,
    orders: true,
    media: true,
    siteSettings: true,
  });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Import State
  // ---------------------------------------------------------------------------
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedPackage, setParsedPackage] = useState<ExportPackage | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('dry_run');
  const [importSelections, setImportSelections] = useState({
    products: true,
    categories: true,
    addons: true,
    coupons: true,
    orders: true,
    media: true,
    siteSettings: true,
  });
  const [verifyR2, setVerifyR2] = useState<boolean>(true);
  const [productionConfirmCode, setProductionConfirmCode] = useState<string>('');
  const [productionAcknowledged, setProductionAcknowledged] = useState<boolean>(false);

  // Preview & Result states
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'SKIP' | 'CONFLICT'>('ALL');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Load Environment and DB Counts
  // ---------------------------------------------------------------------------
  const fetchEnv = async () => {
    try {
      setLoadingEnv(true);
      const res = await fetch('/api/admin/export-import/env');
      const data = await res.json();
      if (data.success) {
        setEnvInfo(data.env);
        setDbCounts(data.counts);
      }
    } catch (err: any) {
      console.error('[ExportImportManager] Failed to fetch env:', err);
    } finally {
      setLoadingEnv(false);
    }
  };

  useEffect(() => {
    fetchEnv();
  }, []);

  // ---------------------------------------------------------------------------
  // Export Handler
  // ---------------------------------------------------------------------------
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);

      const res = await fetch('/api/admin/export-import/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: exportSelections }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalog-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setExportError(err.message || 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle all export options
  const handleSelectAllExport = (selectAll: boolean) => {
    setExportSelections({
      products: selectAll,
      categories: selectAll,
      addons: selectAll,
      coupons: selectAll,
      orders: selectAll,
      media: selectAll,
      siteSettings: selectAll,
    });
  };

  // ---------------------------------------------------------------------------
  // File Upload & Parse
  // ---------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadJsonFile(file);
  };

  const loadJsonFile = (file: File) => {
    setSelectedFile(file);
    setFileError(null);
    setPreviewSummary(null);
    setImportResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.manifest || !json.data) {
          throw new Error('Selected file does not have a valid catalog manifest or data structure.');
        }
        setParsedPackage(json);
        // Pre-enable collections that have records
        setImportSelections({
          products: Boolean(json.data.products?.length),
          categories: Boolean(json.data.categories?.length),
          addons: Boolean(json.data.addons?.length),
          coupons: Boolean(json.data.coupons?.length),
          orders: Boolean(json.data.orders?.length),
          media: Boolean(json.data.media?.length),
          siteSettings: Boolean(json.data.siteSettings),
        });
      } catch (err: any) {
        setFileError(`JSON Parsing Error: ${err.message}`);
        setParsedPackage(null);
      }
    };
    reader.readAsText(file);
  };

  // ---------------------------------------------------------------------------
  // Run Preview (Dry-Run Simulation)
  // ---------------------------------------------------------------------------
  const handleRunPreview = async () => {
    if (!parsedPackage) return;

    try {
      setIsPreviewing(true);
      setImportError(null);
      setPreviewSummary(null);

      const options: ImportOptions = {
        mode: importMode,
        collections: importSelections,
        verifyR2Media: verifyR2,
      };

      const res = await fetch('/api/admin/export-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageData: parsedPackage, options }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (data.errors ? data.errors.join('; ') : 'Preview failed'));
      }

      setPreviewSummary(data.preview);
    } catch (err: any) {
      setImportError(err.message || 'Failed to generate import preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Execute Import
  // ---------------------------------------------------------------------------
  const handleExecuteImport = async () => {
    if (!parsedPackage) return;

    // Safety checks for production
    if (envInfo?.isProduction && importMode !== 'dry_run') {
      if (!productionAcknowledged || productionConfirmCode.trim() !== 'CONFIRM') {
        setImportError('Please complete the production acknowledgment and type CONFIRM before executing.');
        return;
      }
    }

    try {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const options: ImportOptions = {
        mode: importMode,
        collections: importSelections,
        verifyR2Media: verifyR2,
        targetConfirmation: productionConfirmCode.trim(),
      };

      const res = await fetch('/api/admin/export-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageData: parsedPackage, options }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Import failed to complete');
      }

      setImportResult(data.result);
      // Refresh DB counts
      fetchEnv();
    } catch (err: any) {
      setImportError(err.message || 'Execution error during catalog import.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      style={{
        padding: '24px 32px 64px 32px',
        maxWidth: '1280px',
        margin: '0 auto',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        color: 'var(--theme-text)',
      }}
    >
      {/* --------------------------------------------------------------------- */}
      {/* 1. Header Banner & Environment Status                                 */}
      {/* --------------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--theme-elevation-150)',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-0.02em',
              color: 'var(--theme-elevation-900)',
            }}
          >
            Catalog Export &amp; Import
          </h1>
        </div>

        {/* Environment Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {envInfo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                backgroundColor:
                  envInfo.environmentLabel === 'PRODUCTION'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : envInfo.environmentLabel === 'STAGING'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(59, 130, 246, 0.12)',
                color:
                  envInfo.environmentLabel === 'PRODUCTION'
                    ? '#dc2626'
                    : envInfo.environmentLabel === 'STAGING'
                    ? '#d97706'
                    : '#2563eb',
                border: `1px solid ${
                  envInfo.environmentLabel === 'PRODUCTION'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : envInfo.environmentLabel === 'STAGING'
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(59, 130, 246, 0.3)'
                }`,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    envInfo.environmentLabel === 'PRODUCTION'
                      ? '#dc2626'
                      : envInfo.environmentLabel === 'STAGING'
                      ? '#d97706'
                      : '#2563eb',
                }}
              />
              <span>
                {envInfo.environmentLabel || (envInfo.isProduction ? 'PRODUCTION' : 'DEVELOPMENT')}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: 'var(--theme-elevation-400)' }}>
              Detecting environment...
            </div>
          )}
        </div>
      </div>

      {/* Database Record Counts Bar */}
      {dbCounts && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--theme-elevation-50)',
            borderRadius: '8px',
            border: '1px solid var(--theme-elevation-100)',
            marginBottom: '24px',
            fontSize: '0.8125rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--theme-elevation-700)' }}>Current Database Catalog:</span>
          <span>Products: <strong>{dbCounts.products}</strong></span>
          <span>Categories: <strong>{dbCounts.categories}</strong></span>
          <span>Addons: <strong>{dbCounts.addons}</strong></span>
          <span>Coupons: <strong>{dbCounts.coupons}</strong></span>
          <span>Orders: <strong>{dbCounts.orders}</strong></span>
          <span>Media: <strong>{dbCounts.media}</strong></span>
          <span>Settings: <strong>{dbCounts.siteSettings}</strong></span>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. Navigation Tabs                                                    */}
      {/* --------------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid var(--theme-elevation-150)',
        }}
      >
        <button
          onClick={() => setActiveTab('export')}
          style={{
            padding: '10px 20px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'export' ? '2px solid var(--theme-elevation-900)' : '2px solid transparent',
            marginBottom: '-2px',
            color: activeTab === 'export' ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-500)',
            cursor: 'pointer',
          }}
        >
          Export Content
        </button>

        <button
          onClick={() => setActiveTab('import')}
          style={{
            padding: '10px 20px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'import' ? '2px solid var(--theme-elevation-900)' : '2px solid transparent',
            marginBottom: '-2px',
            color: activeTab === 'import' ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-500)',
            cursor: 'pointer',
          }}
        >
          Import Content
        </button>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. EXPORT TAB CONTENT                                                 */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'export' && (
        <div>
          <div
            style={{
              backgroundColor: 'var(--theme-elevation-50)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
                  Select Content to Export
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--theme-elevation-500)' }}>
                  Download a versioned JSON package preserving slugs, variant structures, and media object keys.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleSelectAllExport(true)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--theme-elevation-200)',
                    backgroundColor: 'var(--theme-elevation-100)',
                    cursor: 'pointer',
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllExport(false)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--theme-elevation-200)',
                    backgroundColor: 'var(--theme-elevation-100)',
                    cursor: 'pointer',
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Checkbox Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              {[
                { key: 'products', label: 'Products', count: dbCounts?.products, desc: 'Includes pricing, sizes, care tips, occasions, tags, and gallery rels.' },
                { key: 'categories', label: 'Categories', count: dbCounts?.categories, desc: 'Includes category slugs, merchandising icons, and media references.' },
                { key: 'addons', label: 'Addons', count: dbCounts?.addons, desc: 'Includes gift addons, vases, dimensions, and inventory status.' },
                { key: 'coupons', label: 'Coupons', count: dbCounts?.coupons, desc: 'Includes promo codes, discount percentages, caps, and dates.' },
                { key: 'orders', label: 'Orders', count: dbCounts?.orders, desc: 'Includes customer details, cart items, delivery schedules, and payment logs.' },
                { key: 'media', label: 'Media', count: dbCounts?.media, desc: 'Includes Cloudflare R2 object keys, image sizes, and dimensions.' },
                { key: 'siteSettings', label: 'Site Settings', count: dbCounts?.siteSettings, desc: 'Includes delivery fees, free shipping thresholds, and contact info.' },
              ].map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${(exportSelections as any)[item.key] ? 'var(--theme-elevation-400)' : 'var(--theme-elevation-150)'}`,
                    backgroundColor: (exportSelections as any)[item.key] ? 'var(--theme-elevation-100)' : 'transparent',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(exportSelections as any)[item.key]}
                    onChange={(e) =>
                      setExportSelections((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {item.label} {item.count !== undefined && <span style={{ opacity: 0.65 }}>({item.count})</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {exportError && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '0.8125rem',
                  marginBottom: '16px',
                }}
              >
                {exportError}
              </div>
            )}

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || Object.values(exportSelections).every((v) => !v)}
              style={{
                padding: '12px 24px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: 'var(--theme-elevation-900)',
                color: 'var(--theme-elevation-0, #ffffff)',
                border: 'none',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1,
              }}
            >
              {isExporting ? 'Generating Package...' : 'Download Export Package (.json)'}
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. IMPORT TAB CONTENT                                                 */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'import' && (
        <div>
          {/* Step 1: File Upload Dropzone */}
          <div
            style={{
              backgroundColor: 'var(--theme-elevation-50)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '24px',
            }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 4px 0' }}>
              Step 1: Upload Export Package
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--theme-elevation-500)' }}>
              Select a previously exported JSON file (format version 1.0).
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--theme-elevation-250, #cbd5e1)',
                borderRadius: '10px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'var(--theme-elevation-100)',
                transition: 'border-color 0.2s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '4px' }}>
                {selectedFile ? selectedFile.name : 'Click to browse or drag and drop export JSON file'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-500)' }}>
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                  : 'JSON files only (up to 25 MB)'}
              </div>
            </div>

            {fileError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  color: '#dc2626',
                  fontSize: '0.8125rem',
                }}
              >
                {fileError}
              </div>
            )}

            {/* Manifest Summary Card */}
            {parsedPackage?.manifest && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  backgroundColor: 'var(--theme-elevation-100)',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-elevation-200)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--theme-elevation-900)' }}>
                  Package Manifest Verified:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                  <div><strong>Format:</strong> {parsedPackage.manifest.format} (v{parsedPackage.manifest.version})</div>
                  <div><strong>Exported:</strong> {new Date(parsedPackage.manifest.timestamp).toLocaleString()}</div>
                  <div><strong>Source:</strong> {parsedPackage.manifest.sourceEnvironment}</div>
                  <div><strong>Total Records:</strong> {parsedPackage.manifest.totalRecords}</div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Import Options & Mode Selection */}
          {parsedPackage && (
            <div
              style={{
                backgroundColor: 'var(--theme-elevation-50)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                Step 2: Import Mode &amp; Configuration
              </h2>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--theme-elevation-500)' }}>
                Choose how records should be merged and mapped into the destination database.
              </p>

              {/* Mode Selection Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                {[
                  {
                    mode: 'dry_run' as ImportMode,
                    title: 'Dry Run (Simulation)',
                    desc: 'Simulate import, verify R2 media, and check all foreign keys with ZERO writes.',
                    badge: 'Recommended First',
                  },
                  {
                    mode: 'create_only' as ImportMode,
                    title: 'Create Only',
                    desc: 'Insert missing records. If a slug or code already exists, skip it without modifying.',
                    badge: 'Safe Additive',
                  },
                  {
                    mode: 'update_existing' as ImportMode,
                    title: 'Update Existing',
                    desc: 'Match existing records by stable slug/code and update modified fields.',
                    badge: 'Full Sync',
                  },
                ].map((item) => (
                  <div
                    key={item.mode}
                    onClick={() => {
                      setImportMode(item.mode);
                      setPreviewSummary(null);
                    }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '8px',
                      border: `2px solid ${importMode === item.mode ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-150)'}`,
                      backgroundColor: importMode === item.mode ? 'var(--theme-elevation-100)' : 'transparent',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{item.title}</span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--theme-elevation-200)',
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--theme-elevation-500)', lineHeight: 1.4 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Collections to Import */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>
                  Collections to Import:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {[
                    { key: 'products', label: 'Products', hasData: Boolean(parsedPackage.data.products?.length) },
                    { key: 'categories', label: 'Categories', hasData: Boolean(parsedPackage.data.categories?.length) },
                    { key: 'addons', label: 'Addons', hasData: Boolean(parsedPackage.data.addons?.length) },
                    { key: 'coupons', label: 'Coupons', hasData: Boolean(parsedPackage.data.coupons?.length) },
                    { key: 'orders', label: 'Orders', hasData: Boolean(parsedPackage.data.orders?.length) },
                    { key: 'media', label: 'Media', hasData: Boolean(parsedPackage.data.media?.length) },
                    { key: 'siteSettings', label: 'Site Settings', hasData: Boolean(parsedPackage.data.siteSettings) },
                  ].map((c) => (
                    <label
                      key={c.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8125rem',
                        cursor: c.hasData ? 'pointer' : 'not-allowed',
                        opacity: c.hasData ? 1 : 0.4,
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={!c.hasData}
                        checked={(importSelections as any)[c.key]}
                        onChange={(e) =>
                          setImportSelections((prev) => ({ ...prev, [c.key]: e.target.checked }))
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* R2 Verification Checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  marginBottom: '20px',
                }}
              >
                <input
                  type="checkbox"
                  checked={verifyR2}
                  onChange={(e) => setVerifyR2(e.target.checked)}
                />
                <span>Verify all referenced image files exist in Cloudflare R2 bucket ({envInfo?.r2Bucket})</span>
              </label>

              {/* Run Preview Button */}
              <button
                type="button"
                onClick={handleRunPreview}
                disabled={isPreviewing}
                style={{
                  padding: '10px 20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: 'var(--theme-elevation-800)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isPreviewing ? 'not-allowed' : 'pointer',
                  opacity: isPreviewing ? 0.7 : 1,
                }}
              >
                {isPreviewing ? 'Analyzing Database & R2...' : 'Generate Import Preview & Dry Run'}
              </button>
            </div>
          )}

          {/* Step 3: Interactive Preview Results */}
          {previewSummary && (
            <div
              style={{
                backgroundColor: 'var(--theme-elevation-50)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                    Step 3: Import Simulation &amp; Conflict Preview
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--theme-elevation-500)' }}>
                    Target: {previewSummary.destinationEnvironment.name}
                  </p>
                </div>

                {/* Safety Status Badge */}
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    backgroundColor: previewSummary.isSafeToProceed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: previewSummary.isSafeToProceed ? '#059669' : '#dc2626',
                  }}
                >
                  {previewSummary.isSafeToProceed ? 'Validation Passed: Safe to Proceed' : 'Action Required: Conflicts Found'}
                </div>
              </div>

              {/* Action Breakdown Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div
                  onClick={() => setPreviewFilter(previewFilter === 'CREATE' ? 'ALL' : 'CREATE')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>
                    +{previewSummary.counts.toCreate}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--theme-elevation-600)' }}>
                    To Create (New Records)
                  </div>
                </div>

                <div
                  onClick={() => setPreviewFilter(previewFilter === 'UPDATE' ? 'ALL' : 'UPDATE')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                    {previewSummary.counts.toUpdate}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--theme-elevation-600)' }}>
                    To Update (Matched by Slug)
                  </div>
                </div>

                <div
                  onClick={() => setPreviewFilter(previewFilter === 'SKIP' ? 'ALL' : 'SKIP')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(100, 116, 139, 0.1)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#475569' }}>
                    {previewSummary.counts.toSkip}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--theme-elevation-600)' }}>
                    To Skip (Already Existing)
                  </div>
                </div>

                <div
                  onClick={() => setPreviewFilter(previewFilter === 'CONFLICT' ? 'ALL' : 'CONFLICT')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: previewSummary.counts.conflicts > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.05)',
                    border: `1px solid ${previewSummary.counts.conflicts > 0 ? '#ef4444' : 'var(--theme-elevation-150)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: previewSummary.counts.conflicts > 0 ? '#dc2626' : '#94a3b8' }}>
                    {previewSummary.counts.conflicts}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--theme-elevation-600)' }}>
                    Conflicts / Unresolved
                  </div>
                </div>
              </div>

              {/* R2 Media Verification Pill */}
              {previewSummary.r2Verification.checked && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: previewSummary.r2Verification.missing.length === 0
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${previewSummary.r2Verification.missing.length === 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    fontSize: '0.8125rem',
                    marginBottom: '16px',
                  }}
                >
                  <span><strong>Cloudflare R2 Storage:</strong> Verified {previewSummary.r2Verification.verified} of {previewSummary.r2Verification.total} files in bucket "{previewSummary.r2Verification.bucket}". </span>
                  {previewSummary.r2Verification.missing.length === 0 ? (
                    <span style={{ color: '#059669', fontWeight: 600 }}>All referenced media assets are present.</span>
                  ) : (
                    <span style={{ color: '#d97706', fontWeight: 600 }}>
                      Notice: {previewSummary.r2Verification.missing.length} file(s) not found in bucket.
                    </span>
                  )}
                </div>
              )}

              {/* Warnings / Errors */}
              {previewSummary.errors.length > 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '0.8125rem',
                    marginBottom: '16px',
                  }}
                >
                  <strong>Unsafe Import Stopped:</strong>
                  <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                    {previewSummary.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Detailed Items Table */}
              <div
                style={{
                  maxHeight: '380px',
                  overflowY: 'auto',
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: '8px',
                  marginBottom: '24px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: 'var(--theme-elevation-100)', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Action</th>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Collection</th>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Identifier / Slug</th>
                      <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Details / Remapping Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewSummary.items
                      .filter((item) => previewFilter === 'ALL' || item.action === previewFilter)
                      .map((item, idx) => {
                        const badgeColor =
                          item.action === 'CREATE'
                            ? '#059669'
                            : item.action === 'UPDATE'
                            ? '#2563eb'
                            : item.action === 'SKIP'
                            ? '#64748b'
                            : '#dc2626';

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid var(--theme-elevation-100)',
                              backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--theme-elevation-50)',
                            }}
                          >
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  color: badgeColor,
                                  backgroundColor: `${badgeColor}18`,
                                  border: `1px solid ${badgeColor}40`,
                                }}
                              >
                                {item.action}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.collection}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.identifier}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--theme-elevation-600)' }}>{item.reason}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* --------------------------------------------------------------- */}
              {/* Step 4: Production Safety Gate & Confirmation                   */}
              {/* --------------------------------------------------------------- */}
              {importMode !== 'dry_run' && (
                <div
                  style={{
                    padding: '20px',
                    borderRadius: '10px',
                    backgroundColor: envInfo?.isProduction
                      ? 'rgba(239, 68, 68, 0.08)'
                      : 'var(--theme-elevation-100)',
                    border: `1px solid ${envInfo?.isProduction ? 'rgba(239, 68, 68, 0.3)' : 'var(--theme-elevation-200)'}`,
                    marginBottom: '20px',
                  }}
                >
                  {envInfo?.isProduction ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', fontWeight: 700, marginBottom: '8px' }}>
                        <span>PRODUCTION ENVIRONMENT WRITE PROTECTION</span>
                      </div>
                      <p style={{ margin: '0 0 12px 0', fontSize: '0.8125rem', color: '#991b1b', lineHeight: 1.5 }}>
                        You are targeting the <strong>PRODUCTION</strong> database. Any writes will immediately modify the live storefront. All changes are executed inside an atomic transaction and will automatically roll back on error.
                      </p>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: '12px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={productionAcknowledged}
                          onChange={(e) => setProductionAcknowledged(e.target.checked)}
                        />
                        <span>I have reviewed the simulation results and authorize writing catalog data to production.</span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Type CONFIRM to unlock:</span>
                        <input
                          type="text"
                          value={productionConfirmCode}
                          onChange={(e) => setProductionConfirmCode(e.target.value)}
                          placeholder="CONFIRM"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--theme-elevation-300)',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            width: '120px',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>
                        Ready to apply changes to {envInfo?.environmentLabel || 'DEVELOPMENT'}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--theme-elevation-500)' }}>
                        Changes will be committed safely inside a single database transaction.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {importError && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#dc2626',
                    fontSize: '0.8125rem',
                    marginBottom: '16px',
                  }}
                >
                  {importError}
                </div>
              )}

              {/* Execute Button */}
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={
                  isImporting ||
                  !previewSummary.isSafeToProceed ||
                  (envInfo?.isProduction &&
                    importMode !== 'dry_run' &&
                    (!productionAcknowledged || productionConfirmCode.trim() !== 'CONFIRM'))
                }
                style={{
                  padding: '12px 24px',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  backgroundColor: importMode === 'dry_run' ? 'var(--theme-elevation-800)' : '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  opacity:
                    isImporting ||
                    !previewSummary.isSafeToProceed ||
                    (envInfo?.isProduction &&
                      importMode !== 'dry_run' &&
                      (!productionAcknowledged || productionConfirmCode.trim() !== 'CONFIRM'))
                      ? 0.5
                      : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>
                  {isImporting
                    ? 'Executing Import Transaction...'
                    : importMode === 'dry_run'
                    ? 'Run Dry Run Only'
                    : `Execute Live Import (${importMode === 'create_only' ? 'Create Only' : 'Update Existing'})`}
                </span>
              </button>
            </div>
          )}

          {/* Step 5: Execution Result Card */}
          {importResult && (
            <div
              style={{
                backgroundColor: 'var(--theme-elevation-50)',
                border: '1px solid var(--theme-elevation-150)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                  color: importResult.success ? '#059669' : '#dc2626',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                    {importResult.mode === 'dry_run'
                      ? 'Dry Run Completed Successfully'
                      : 'Catalog Import Completed & Committed'}
                  </h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--theme-elevation-500)', marginTop: '2px' }}>
                    Target: {importResult.destinationEnvironment.name} — {new Date(importResult.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Summary Stats Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--theme-elevation-100)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>
                    {importResult.counts.created}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)' }}>Records Created</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--theme-elevation-100)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                    {importResult.counts.updated}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)' }}>Records Updated</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--theme-elevation-100)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#64748b' }}>
                    {importResult.counts.skipped}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)' }}>Records Skipped</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--theme-elevation-100)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
                    {importResult.sequencesUpdated.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)' }}>PostgreSQL Sequences Synced</div>
                </div>
              </div>

              {/* Execution Logs */}
              {importResult.logs.length > 0 && (
                <div
                  style={{
                    backgroundColor: 'var(--theme-elevation-900)',
                    color: '#e2e8f0',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    lineHeight: 1.6,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {importResult.logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
