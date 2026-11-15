import React, { useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { Badge } from '../components/Badge'

const CATEGORIES = [
  'Lubricants & Oils',
  'Filters (Oil, Air, Fuel)',
  'Braking System',
  'Suspension & Steering',
  'Electrical & Batteries',
  'Ignition & Plugs',
  'Fluids & Coolants',
  'Belts & Hoses',
  'General Spares'
]

export const Inventory = ({ prefillReceiveItem = null }) => {
  const [activeView, setActiveView] = useState('catalog') // 'catalog' | 'danger' | 'suppliers'
  const [items, setItems] = useState([])
  const [dangerItems, setDangerItems] = useState([])
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalStockValuation: 0,
    totalPotentialSalesValue: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  // Suppliers & Purchase Batches (SCRUM-25 & SCRUM-29)
  const [suppliers, setSuppliers] = useState([])
  const [allSuppliers, setAllSuppliers] = useState([])
  const [showInactiveSuppliers, setShowInactiveSuppliers] = useState(false)
  const [purchaseBatches, setPurchaseBatches] = useState([])
  const [purchaseFilterSupplierId, setPurchaseFilterSupplierId] = useState('')
  const [purchaseSearch, setPurchaseSearch] = useState('')

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isReceiveBatchOpen, setIsReceiveBatchOpen] = useState(false)
  const [selectedItemDetail, setSelectedItemDetail] = useState(null)
  const [editingItem, setEditingItem] = useState(null)

  // Forms
  const [itemForm, setItemForm] = useState({
    sku: '',
    name: '',
    category: CATEGORIES[0],
    defaultSupplierId: '',
    minimumStockLevel: '5',
    currentSellingPrice: '',
    notes: '',
    initialQty: '',
    initialUnitCost: ''
  })

  const [batchForm, setBatchForm] = useState({
    inventoryItemId: '',
    batchNo: '',
    supplierId: '',
    supplierDocumentNo: '',
    receivedAt: new Date().toISOString().slice(0, 10),
    receivedQty: '',
    unitCost: '',
    expiryDate: '',
    notes: ''
  })

  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Supplier Add / Edit Modal State (SCRUM-24 & SCRUM-29)
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supplierTargetContext, setSupplierTargetContext] = useState(null)
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: ''
  })
  const [supplierFormError, setSupplierFormError] = useState('')
  const [isSupplierSubmitting, setIsSupplierSubmitting] = useState(false)

  const loadInventory = async () => {
    try {
      setLoading(true)
      const filters = {
        search,
        category: selectedCategory !== 'all' ? selectedCategory : null,
        lowStockOnly
      }
      const [itemsList, lowList, sum, activeSupps, fullSupps, batchesList] = await Promise.all([
        window.omega.inventory.list(filters),
        window.omega.inventory.list({ lowStockOnly: true }),
        window.omega.inventory.getSummary(),
        window.omega.inventory.getSuppliers({ includeInactive: false }),
        window.omega.inventory.getSuppliers({ includeInactive: showInactiveSuppliers }),
        window.omega.inventory.getPurchaseBatches({
          supplierId: purchaseFilterSupplierId || null,
          search: purchaseSearch
        })
      ])
      setItems(itemsList)
      setDangerItems(lowList)
      setSummary(sum)
      setSuppliers(activeSupps)
      setAllSuppliers(fullSupps)
      setPurchaseBatches(batchesList)
    } catch (err) {
      console.error('Failed to load inventory:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [search, selectedCategory, lowStockOnly, showInactiveSuppliers, purchaseFilterSupplierId, purchaseSearch])

  useEffect(() => {
    if (prefillReceiveItem) {
      openReceiveBatchFor(prefillReceiveItem)
    }
  }, [prefillReceiveItem])

  const openItemDetail = async (id) => {
    try {
      const data = await window.omega.inventory.get(id)
      setSelectedItemDetail(data)
    } catch (err) {
      console.error('Failed to load item detail:', err)
    }
  }

  const openReceiveBatchFor = (item, prefillRecommended = false) => {
    setFormError('')
    const recommendedQty = prefillRecommended && item.recommendedReorderQty > 0
      ? String(item.recommendedReorderQty)
      : ''
    const suggestedCost = prefillRecommended && item.weightedUnitCost > 0
      ? String(Math.round(item.weightedUnitCost))
      : ''

    setBatchForm({
      inventoryItemId: item.id,
      batchNo: '',
      supplierId: item.defaultSupplierId || (suppliers[0]?.id || ''),
      supplierDocumentNo: '',
      receivedAt: new Date().toISOString().slice(0, 10),
      receivedQty: recommendedQty,
      unitCost: suggestedCost,
      expiryDate: '',
      notes: ''
    })
    setIsReceiveBatchOpen(true)
  }

  const handleCreateItem = async (e) => {
    e.preventDefault()
    setFormError('')
    const trimmedName = itemForm.name.trim()
    if (!trimmedName) {
      setFormError('Item name is required.')
      return
    }

    if (itemForm.sku && !itemForm.sku.trim()) {
      setFormError('SKU cannot be whitespace-only.')
      return
    }

    const trimmedMin = String(itemForm.minimumStockLevel ?? '').trim()
    const minStock = Number(trimmedMin)
    if (trimmedMin !== '' && (!Number.isFinite(minStock) || minStock < 0)) {
      setFormError('Minimum stock level must be a non-negative finite number.')
      return
    }

    const trimmedSell = String(itemForm.currentSellingPrice ?? '').trim()
    const sellPrice = Number(trimmedSell)
    if (trimmedSell !== '' && (!Number.isFinite(sellPrice) || sellPrice < 0)) {
      setFormError('Current selling price must be a non-negative finite number.')
      return
    }

    let initialBatch = null
    const trimmedQty = String(itemForm.initialQty ?? '').trim()
    if (trimmedQty !== '') {
      const initQ = Number(trimmedQty)
      if (!Number.isFinite(initQ) || initQ <= 0) {
        setFormError('Initial batch quantity must be greater than 0.')
        return
      }
      const trimmedCost = String(itemForm.initialUnitCost ?? '').trim()
      const initCost = trimmedCost !== '' ? Number(trimmedCost) : 0
      if (!Number.isFinite(initCost) || initCost < 0) {
        setFormError('Initial unit cost must be a non-negative finite number.')
        return
      }
      initialBatch = {
        qty: initQ,
        unitCost: initCost,
        supplierId: itemForm.defaultSupplierId ? parseInt(itemForm.defaultSupplierId, 10) : null
      }
    }

    try {
      setIsSubmitting(true)
      await window.omega.inventory.createItem({
        sku: itemForm.sku ? itemForm.sku.trim() : '',
        name: trimmedName,
        category: itemForm.category,
        defaultSupplierId: itemForm.defaultSupplierId ? parseInt(itemForm.defaultSupplierId, 10) : null,
        minimumStockLevel: trimmedMin !== '' ? minStock : 5,
        currentSellingPrice: trimmedSell !== '' ? sellPrice : 0,
        notes: itemForm.notes.trim(),
        initialBatch
      })

      setIsAddItemOpen(false)
      setItemForm({
        sku: '',
        name: '',
        category: CATEGORIES[0],
        defaultSupplierId: '',
        minimumStockLevel: '5',
        currentSellingPrice: '',
        notes: '',
        initialQty: '',
        initialUnitCost: ''
      })
      loadInventory()
    } catch (err) {
      setFormError(err.message || 'Failed to create item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReceiveBatch = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!batchForm.inventoryItemId) {
      setFormError('Valid item is required.')
      return
    }

    const trimmedQty = String(batchForm.receivedQty ?? '').trim()
    const qty = Number(trimmedQty)
    if (trimmedQty === '' || !Number.isFinite(qty) || qty <= 0) {
      setFormError('Received quantity must be a positive number greater than 0.')
      return
    }

    const trimmedCost = String(batchForm.unitCost ?? '').trim()
    const cost = trimmedCost !== '' ? Number(trimmedCost) : 0
    if (!Number.isFinite(cost) || cost < 0) {
      setFormError('Unit cost must be a non-negative finite number.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.inventory.receiveBatch({
        inventoryItemId: parseInt(batchForm.inventoryItemId, 10),
        batchNo: batchForm.batchNo.trim(),
        supplierId: batchForm.supplierId ? parseInt(batchForm.supplierId, 10) : null,
        supplierDocumentNo: batchForm.supplierDocumentNo.trim(),
        receivedAt: batchForm.receivedAt,
        receivedQty: qty,
        unitCost: cost,
        expiryDate: batchForm.expiryDate || null,
        notes: batchForm.notes.trim()
      })

      setIsReceiveBatchOpen(false)
      loadInventory()
      if (selectedItemDetail && selectedItemDetail.id === parseInt(batchForm.inventoryItemId, 10)) {
        openItemDetail(selectedItemDetail.id)
      }
    } catch (err) {
      setFormError(err.message || 'Failed to receive stock batch.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateItem = async (e) => {
    e.preventDefault()
    setFormError('')
    const trimmedName = itemForm.name.trim()
    if (!trimmedName) {
      setFormError('Item name is required.')
      return
    }

    if (itemForm.sku && !itemForm.sku.trim()) {
      setFormError('SKU cannot be whitespace-only.')
      return
    }

    const trimmedMin = String(itemForm.minimumStockLevel ?? '').trim()
    const minStock = Number(trimmedMin)
    if (trimmedMin !== '' && (!Number.isFinite(minStock) || minStock < 0)) {
      setFormError('Minimum stock level must be a non-negative finite number.')
      return
    }

    const trimmedSell = String(itemForm.currentSellingPrice ?? '').trim()
    const sellPrice = Number(trimmedSell)
    if (trimmedSell !== '' && (!Number.isFinite(sellPrice) || sellPrice < 0)) {
      setFormError('Current selling price must be a non-negative finite number.')
      return
    }

    try {
      setIsSubmitting(true)
      await window.omega.inventory.updateItem(editingItem.id, {
        sku: itemForm.sku ? itemForm.sku.trim() : undefined,
        name: trimmedName,
        category: itemForm.category,
        defaultSupplierId: itemForm.defaultSupplierId ? parseInt(itemForm.defaultSupplierId, 10) : null,
        minimumStockLevel: trimmedMin !== '' ? minStock : undefined,
        currentSellingPrice: trimmedSell !== '' ? sellPrice : undefined,
        notes: itemForm.notes.trim()
      })
      setEditingItem(null)
      loadInventory()
      if (selectedItemDetail && selectedItemDetail.id === editingItem.id) {
        openItemDetail(editingItem.id)
      }
    } catch (err) {
      setFormError(err.message || 'Failed to update item.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveSupplier = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    setSupplierFormError('')
    const trimmedName = supplierForm.name.trim()
    if (!trimmedName) {
      setSupplierFormError('Supplier / Vendor name is required.')
      return
    }

    try {
      setIsSupplierSubmitting(true)
      if (editingSupplier) {
        await window.omega.inventory.updateSupplier(editingSupplier.id, {
          name: trimmedName,
          phone: supplierForm.phone.trim(),
          address: supplierForm.address.trim(),
          notes: supplierForm.notes.trim()
        })
      } else {
        const created = await window.omega.inventory.createSupplier({
          name: trimmedName,
          phone: supplierForm.phone.trim(),
          address: supplierForm.address.trim(),
          notes: supplierForm.notes.trim()
        })

        if (created && created.id) {
          if (supplierTargetContext === 'itemForm' || supplierTargetContext === 'editItem') {
            setItemForm((prev) => ({ ...prev, defaultSupplierId: String(created.id) }))
          } else if (supplierTargetContext === 'batchForm') {
            setBatchForm((prev) => ({ ...prev, supplierId: String(created.id) }))
          }
        }
      }

      setIsAddSupplierOpen(false)
      setEditingSupplier(null)
      setSupplierForm({ name: '', phone: '', address: '', notes: '' })
      setSupplierTargetContext(null)
      loadInventory()
    } catch (err) {
      setSupplierFormError(err.message || 'Failed to save supplier.')
    } finally {
      setIsSupplierSubmitting(false)
    }
  }

  const handleToggleSupplierActive = async (supplier) => {
    const nextState = supplier.is_active ? 0 : 1
    const actionWord = nextState === 0 ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${actionWord} supplier "${supplier.name}"?`)) return
    try {
      await window.omega.inventory.deactivateSupplier(supplier.id, nextState)
      loadInventory()
    } catch (err) {
      alert(err.message || 'Failed to update supplier status.')
    }
  }

  // Stock Danger List computed summary (SCRUM-28)
  const outOfStockCount = dangerItems.filter((i) => (i.totalStock || 0) <= 0).length
  const estimatedRestockCost = dangerItems.reduce((sum, i) => {
    const unitCostEstimate = i.weightedUnitCost > 0 ? i.weightedUnitCost : (i.currentSellingPrice || 0) * 0.7
    return sum + (i.recommendedReorderQty || 0) * unitCostEstimate
  }, 0)

  return (
    <div className="content-scrollable">
      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
          <div className="kpi-label">Total Item Masters</div>
          <div className="kpi-value">{summary.totalItems}</div>
          <div className="kpi-subtext">Registered catalog parts</div>
        </div>

        <div
          className="kpi-card"
          style={{ '--accent-color': 'var(--danger)', cursor: 'pointer' }}
          onClick={() => setActiveView('danger')}
          title="Click to open Stock Danger List"
        >
          <div className="kpi-label">Low-Stock Danger List</div>
          <div className="kpi-value" style={{ color: summary.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {summary.lowStockCount}
          </div>
          <div className="kpi-subtext">
            {outOfStockCount > 0 ? `${outOfStockCount} out of stock • Click to reorder` : 'Below reorder minimum'}
          </div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--warning)' }}>
          <div className="kpi-label">Stock Valuation (Cost)</div>
          <div className="kpi-value" style={{ fontSize: '20px' }}>
            Rs. {Math.round(summary.totalStockValuation).toLocaleString()}
          </div>
          <div className="kpi-subtext">Sum of active FIFO batch costs</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--success)' }}>
          <div className="kpi-label">Potential Sales Value</div>
          <div className="kpi-value" style={{ fontSize: '20px' }}>
            Rs. {Math.round(summary.totalPotentialSalesValue).toLocaleString()}
          </div>
          <div className="kpi-subtext">Current selling price valuation</div>
        </div>
      </div>

      {/* View Switcher Tabs (SCRUM-24, SCRUM-25, SCRUM-28, SCRUM-29) */}
      <div className="toolbar" style={{ marginBottom: '14px' }}>
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${activeView === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveView('catalog')}
          >
            📦 All Stock Items ({summary.totalItems})
          </button>
          <button
            type="button"
            className={`chip ${activeView === 'danger' ? 'active' : ''}`}
            onClick={() => setActiveView('danger')}
            style={
              summary.lowStockCount > 0 && activeView !== 'danger'
                ? { borderColor: 'var(--danger)', color: 'var(--danger-text)', fontWeight: 700 }
                : undefined
            }
          >
            🚨 Stock Danger List ({summary.lowStockCount})
          </button>
          <button
            type="button"
            className={`chip ${activeView === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveView('suppliers')}
          >
            🏢 Suppliers &amp; Purchase Invoices ({suppliers.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setEditingSupplier(null)
              setSupplierFormError('')
              setSupplierForm({ name: '', phone: '', address: '', notes: '' })
              setSupplierTargetContext(null)
              setIsAddSupplierOpen(true)
            }}
          >
            🏢 + Add Supplier
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (items.length > 0) {
                openReceiveBatchFor(items[0])
              } else {
                alert('Please add an inventory item first.')
              }
            }}
          >
            + Receive Stock Batch (GRN)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError('')
              setItemForm({
                sku: '',
                name: '',
                category: CATEGORIES[0],
                defaultSupplierId: '',
                minimumStockLevel: '5',
                currentSellingPrice: '',
                notes: '',
                initialQty: '',
                initialUnitCost: ''
              })
              setIsAddItemOpen(true)
            }}
          >
            + Add New Item
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: ALL STOCK ITEMS CATALOG (SCRUM-24)                          */}
      {/* =================================================================== */}
      {activeView === 'catalog' && (
        <>
          <div className="toolbar">
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by part name or SKU..."
                />
              </div>

              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '170px' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button
                type="button"
                className={`chip ${lowStockOnly ? 'active' : ''}`}
                onClick={() => setLowStockOnly(!lowStockOnly)}
              >
                ⚠️ Low Stock Filter
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading inventory stock...
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No inventory items found. Click &quot;+ Add New Item&quot; to register parts.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU / Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Total In Stock</th>
                    <th>Reorder Level</th>
                    <th>FIFO Avg Cost</th>
                    <th>Selling Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ background: item.isLowStock ? '#FFFDF8' : 'transparent' }}>
                      <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{item.sku}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</div>
                        {item.defaultSupplierName && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Supplier: {item.defaultSupplierName}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', background: 'var(--bg-main)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: item.isLowStock ? 'var(--danger)' : 'var(--text-main)' }}>
                          {item.totalStock}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                          ({item.activeBatchesCount} {item.activeBatchesCount === 1 ? 'batch' : 'batches'})
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.minimumStockLevel} units</td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        Rs. {Math.round(item.weightedUnitCost).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        Rs. {item.currentSellingPrice ? item.currentSellingPrice.toLocaleString() : '0.00'}
                      </td>
                      <td>
                        <Badge
                          status={item.isLowStock ? 'low_stock' : 'in_stock'}
                          text={item.isLowStock ? 'Low Stock' : 'In Stock'}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openItemDetail(item.id)}
                          >
                            Batches ({item.activeBatchesCount}) →
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => openReceiveBatchFor(item)}
                          >
                            + Receive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: STOCK DANGER LIST / LOW-STOCK REPLENISHMENT (SCRUM-28)      */}
      {/* =================================================================== */}
      {activeView === 'danger' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '14px',
              marginBottom: '16px',
              padding: '16px 20px',
              background: '#FFF5F5',
              border: '1px solid rgba(227, 87, 87, 0.35)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger-text)', textTransform: 'uppercase' }}>
                Critical Danger Items (At / Below Reorder Level)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>
                {dangerItems.length} Parts
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger-text)', textTransform: 'uppercase' }}>
                Completely Depleted (0 Stock)
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: outOfStockCount > 0 ? 'var(--danger)' : 'var(--text-main)', marginTop: '4px' }}>
                {outOfStockCount} Parts
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger-text)', textTransform: 'uppercase' }}>
                Est. Replenishment Budget
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                Rs. {Math.round(estimatedRestockCost).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ padding: '16px 20px', margin: 0 }}>
              <div>
                <h3 className="card-title" style={{ color: 'var(--danger-text)' }}>
                  🚨 Stock Danger &amp; Reorder Action List
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Items where current stock is equal to or below the minimum reorder threshold
                </div>
              </div>
            </div>

            {dangerItems.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--success-text)', fontWeight: 600 }}>
                ✅ All inventory items are currently above their minimum reorder levels!
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Part Name &amp; Category</th>
                    <th>Current Stock</th>
                    <th>Min Threshold</th>
                    <th>Shortfall</th>
                    <th>Recommended Reorder</th>
                    <th>Preferred Supplier &amp; Phone</th>
                    <th>Urgency</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dangerItems.map((item) => {
                    const isZero = (item.totalStock || 0) <= 0
                    return (
                      <tr key={item.id} style={{ background: isZero ? '#FFF0F0' : '#FFFDF8' }}>
                        <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{item.sku}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.category}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--danger)' }}>
                            {item.totalStock}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.minimumStockLevel} units</td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--danger-text)' }}>
                            {item.shortfallQty > 0 ? `-${item.shortfallQty} units` : 'At limit'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', padding: '3px 8px', borderRadius: '6px' }}>
                            +{item.recommendedReorderQty} units
                          </span>
                        </td>
                        <td>
                          {item.defaultSupplierName ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{item.defaultSupplierName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {item.defaultSupplierPhone || 'No phone on file'}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unassigned</span>
                          )}
                        </td>
                        <td>
                          <Badge
                            status="low_stock"
                            text={isZero ? 'OUT OF STOCK' : 'LOW STOCK'}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => openReceiveBatchFor(item, true)}
                          >
                            📥 Replenish (+{item.recommendedReorderQty})
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 3: SUPPLIERS CRUD & PURCHASE INVOICE / GRN LOG (SCRUM-25 & 29) */}
      {/* =================================================================== */}
      {activeView === 'suppliers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Supplier Directory Card (SCRUM-29) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
            <div className="card-header" style={{ padding: '16px 20px', margin: 0 }}>
              <div>
                <h3 className="card-title">🏢 Registered Spare Parts Suppliers</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Maintain supplier contact records and review supplier purchase volume
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={showInactiveSuppliers}
                    onChange={(e) => setShowInactiveSuppliers(e.target.checked)}
                  />
                  Show Inactive Suppliers
                </label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingSupplier(null)
                    setSupplierFormError('')
                    setSupplierForm({ name: '', phone: '', address: '', notes: '' })
                    setSupplierTargetContext(null)
                    setIsAddSupplierOpen(true)
                  }}
                >
                  + Register Supplier
                </button>
              </div>
            </div>

            {allSuppliers.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No suppliers registered yet. Click &quot;+ Register Supplier&quot; to add a vendor.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Supplier Name</th>
                    <th>Contact Phone</th>
                    <th>Address</th>
                    <th>Notes</th>
                    <th>GRN Batches</th>
                    <th>Total Purchases</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allSuppliers.map((s) => (
                    <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.6 }}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td style={{ fontWeight: 600 }}>{s.phone || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{s.address || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{s.notes || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{s.batchesCount || 0}</td>
                      <td style={{ fontWeight: 700 }}>
                        Rs. {Math.round(s.totalPurchasesValue || 0).toLocaleString()}
                      </td>
                      <td>
                        <Badge
                          status={s.is_active ? 'available' : 'off_duty'}
                          text={s.is_active ? 'Active' : 'Inactive'}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingSupplier(s)
                              setSupplierFormError('')
                              setSupplierForm({
                                name: s.name || '',
                                phone: s.phone || '',
                                address: s.address || '',
                                notes: s.notes || ''
                              })
                              setIsAddSupplierOpen(true)
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${s.is_active ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggleSupplierActive(s)}
                          >
                            {s.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Supplier Purchase Invoices / GRN History Card (SCRUM-25) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
            <div className="card-header" style={{ padding: '16px 20px', margin: 0, flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="card-title">🧾 Supplier Purchase Invoices &amp; GRN Batch Log</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  History of stock batches received from suppliers with GRN / Supplier Invoice references
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '220px', padding: '6px 10px', fontSize: '12px' }}
                  placeholder="Search GRN #, Batch #, or Part..."
                  value={purchaseSearch}
                  onChange={(e) => setPurchaseSearch(e.target.value)}
                />
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: '180px', padding: '6px 10px', fontSize: '12px' }}
                  value={purchaseFilterSupplierId}
                  onChange={(e) => setPurchaseFilterSupplierId(e.target.value)}
                >
                  <option value="">All Suppliers</option>
                  {allSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {purchaseBatches.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No supplier purchase batches match the selected filters.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Received Date</th>
                    <th>Supplier Invoice / GRN No</th>
                    <th>Batch No</th>
                    <th>Supplier</th>
                    <th>Part (SKU)</th>
                    <th>Qty Received</th>
                    <th>Remaining</th>
                    <th>Unit Cost</th>
                    <th>Total Batch Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseBatches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{b.receivedAt}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {b.supplierDocumentNo || '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{b.batchNo}</td>
                      <td style={{ fontWeight: 600 }}>{b.supplierName}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.itemName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.itemSku}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{b.receivedQty}</td>
                      <td style={{ color: b.remainingQty > 0 ? 'var(--success-text)' : 'var(--text-muted)', fontWeight: 700 }}>
                        {b.remainingQty}
                      </td>
                      <td>Rs. {Number(b.unitCost || 0).toLocaleString()}</td>
                      <td style={{ fontWeight: 800 }}>
                        Rs. {Math.round(b.totalCost || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Item Detail / Batch Breakdown Modal */}
      {selectedItemDetail && (
        <Modal
          isOpen={true}
          title={`Inventory Batches for: ${selectedItemDetail.name}`}
          size="lg"
          onClose={() => setSelectedItemDetail(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingItem(selectedItemDetail)
                  setItemForm({
                    sku: selectedItemDetail.sku || '',
                    name: selectedItemDetail.name,
                    category: selectedItemDetail.category,
                    defaultSupplierId: selectedItemDetail.defaultSupplierId || '',
                    minimumStockLevel: String(selectedItemDetail.minimumStockLevel),
                    currentSellingPrice: String(selectedItemDetail.currentSellingPrice),
                    notes: selectedItemDetail.notes || ''
                  })
                }}
              >
                ✏️ Edit Item Master
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openReceiveBatchFor(selectedItemDetail)}
              >
                + Receive New Batch for this Item
              </button>
            </div>
          }
        >
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL STOCK</div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: selectedItemDetail.isLowStock ? 'var(--danger)' : 'var(--text-main)' }}>
                  {selectedItemDetail.totalStock} units
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>SELLING PRICE</div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Rs. {selectedItemDetail.currentSellingPrice?.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>STOCK VALUATION</div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>Rs. {Math.round(selectedItemDetail.totalCostValuation).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>REORDER THRESHOLD</div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{selectedItemDetail.minimumStockLevel} units</div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 700 }}>
              Batch Tracking (FIFO Cost Allocation)
            </h4>

            {selectedItemDetail.batches?.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                No stock batches received yet. Click &quot;+ Receive New Batch&quot; to add stock.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch No</th>
                    <th>Received Date</th>
                    <th>Supplier</th>
                    <th>GRN / Doc No</th>
                    <th>Unit Cost</th>
                    <th>Received Qty</th>
                    <th>Remaining Qty</th>
                    <th>Batch Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItemDetail.batches.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 700 }}>{b.batchNo}</td>
                      <td>{b.receivedAt}</td>
                      <td>{b.supplierName || '—'}</td>
                      <td>{b.supplierDocumentNo || '—'}</td>
                      <td style={{ fontWeight: 600 }}>Rs. {b.unitCost.toLocaleString()}</td>
                      <td>{b.receivedQty}</td>
                      <td style={{ fontWeight: 800, color: b.remainingQty > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {b.remainingQty}
                      </td>
                      <td>
                        <Badge
                          status={b.remainingQty > 0 ? 'available' : 'off_duty'}
                          text={b.remainingQty > 0 ? 'Active Stock' : 'Depleted'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {/* Add New Item Modal */}
      {isAddItemOpen && (
        <Modal
          isOpen={true}
          title="Add New Inventory Item"
          size="lg"
          onClose={() => setIsAddItemOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddItemOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateItem}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Item'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateItem}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Item Name <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g. Brake Pad Set, Synthetic Engine Oil 4L"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">SKU / Item Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  placeholder="e.g. INV-1042"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Default Supplier</label>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2563EB)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    onClick={() => {
                      setEditingSupplier(null)
                      setSupplierFormError('')
                      setSupplierForm({ name: '', phone: '', address: '', notes: '' })
                      setSupplierTargetContext('itemForm')
                      setIsAddSupplierOpen(true)
                    }}
                  >
                    + New Supplier
                  </button>
                </div>
                <select
                  className="form-select"
                  value={itemForm.defaultSupplierId}
                  onChange={(e) => setItemForm({ ...itemForm, defaultSupplierId: e.target.value })}
                >
                  <option value="">-- None / Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Current Selling Price (Rs.) <span className="req">*</span></label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={itemForm.currentSellingPrice}
                  onChange={(e) => setItemForm({ ...itemForm, currentSellingPrice: e.target.value })}
                  placeholder="e.g. 5500"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Reorder Level (Low Stock Alert)</label>
                <input
                  type="number"
                  className="form-input"
                  value={itemForm.minimumStockLevel}
                  onChange={(e) => setItemForm({ ...itemForm, minimumStockLevel: e.target.value })}
                  placeholder="e.g. 5"
                />
              </div>
            </div>

            {/* Optional Initial Stock Batch */}
            <div style={{ marginTop: '14px', padding: '14px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                Initial Stock Batch (Optional)
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Initial Quantity in Stock</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={itemForm.initialQty}
                    onChange={(e) => setItemForm({ ...itemForm, initialQty: e.target.value })}
                    placeholder="e.g. 10"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Cost Price (Rs.)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={itemForm.initialUnitCost}
                    onChange={(e) => setItemForm({ ...itemForm, initialUnitCost: e.target.value })}
                    placeholder="e.g. 4200"
                  />
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Receive Stock / Add Batch Modal */}
      {isReceiveBatchOpen && (
        <Modal
          isOpen={true}
          title="Receive Supplier Stock Batch (GRN / Purchase Invoice)"
          onClose={() => setIsReceiveBatchOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReceiveBatchOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReceiveBatch}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Receiving...' : 'Add Stock Batch'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleReceiveBatch}>
            <div className="form-group">
              <label className="form-label">Item / Part <span className="req">*</span></label>
              <select
                className="form-select"
                value={batchForm.inventoryItemId}
                onChange={(e) => setBatchForm({ ...batchForm, inventoryItemId: e.target.value })}
                required
              >
                <option value="">Select item...</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.sku}) • Current Stock: {i.totalStock}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Received Quantity <span className="req">*</span></label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={batchForm.receivedQty}
                  onChange={(e) => setBatchForm({ ...batchForm, receivedQty: e.target.value })}
                  placeholder="e.g. 20"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Cost Price (Rs.) <span className="req">*</span></label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={batchForm.unitCost}
                  onChange={(e) => setBatchForm({ ...batchForm, unitCost: e.target.value })}
                  placeholder="e.g. 3800"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Received Date <span className="req">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={batchForm.receivedAt}
                  onChange={(e) => setBatchForm({ ...batchForm, receivedAt: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Supplier</label>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2563EB)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    onClick={() => {
                      setEditingSupplier(null)
                      setSupplierFormError('')
                      setSupplierForm({ name: '', phone: '', address: '', notes: '' })
                      setSupplierTargetContext('batchForm')
                      setIsAddSupplierOpen(true)
                    }}
                  >
                    + New Supplier
                  </button>
                </div>
                <select
                  className="form-select"
                  value={batchForm.supplierId}
                  onChange={(e) => setBatchForm({ ...batchForm, supplierId: e.target.value })}
                >
                  <option value="">-- None / Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Batch No. (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={batchForm.batchNo}
                  onChange={(e) => setBatchForm({ ...batchForm, batchNo: e.target.value })}
                  placeholder="Auto-generated if empty"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Invoice / GRN Document No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={batchForm.supplierDocumentNo}
                  onChange={(e) => setBatchForm({ ...batchForm, supplierDocumentNo: e.target.value })}
                  placeholder="e.g. GRN-2026-89 / INV-4401"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Item Master Modal */}
      {editingItem && (
        <Modal
          isOpen={true}
          title={`Edit Item Master: ${editingItem.name}`}
          onClose={() => setEditingItem(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingItem(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpdateItem}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Item Master'}
              </button>
            </>
          }
        >
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {formError}
            </div>
          )}
          <form onSubmit={handleUpdateItem}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Item Name <span className="req">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">SKU / Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Default Supplier</label>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2563EB)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    onClick={() => {
                      setEditingSupplier(null)
                      setSupplierFormError('')
                      setSupplierForm({ name: '', phone: '', address: '', notes: '' })
                      setSupplierTargetContext('editItem')
                      setIsAddSupplierOpen(true)
                    }}
                  >
                    + New Supplier
                  </button>
                </div>
                <select
                  className="form-select"
                  value={itemForm.defaultSupplierId}
                  onChange={(e) => setItemForm({ ...itemForm, defaultSupplierId: e.target.value })}
                >
                  <option value="">-- None / Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Selling Price (Rs.)</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={itemForm.currentSellingPrice}
                  onChange={(e) => setItemForm({ ...itemForm, currentSellingPrice: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reorder Level (Low Stock Alert)</label>
                <input
                  type="number"
                  className="form-input"
                  value={itemForm.minimumStockLevel}
                  onChange={(e) => setItemForm({ ...itemForm, minimumStockLevel: e.target.value })}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit Supplier Modal (SCRUM-24 & SCRUM-29) */}
      {isAddSupplierOpen && (
        <Modal
          isOpen={true}
          title={editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Parts Supplier'}
          onClose={() => {
            setIsAddSupplierOpen(false)
            setEditingSupplier(null)
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAddSupplierOpen(false)
                  setEditingSupplier(null)
                }}
                disabled={isSupplierSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSupplier}
                disabled={isSupplierSubmitting}
              >
                {isSupplierSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </>
          }
        >
          {supplierFormError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
              {supplierFormError}
            </div>
          )}

          <form onSubmit={handleSaveSupplier}>
            <div className="form-group">
              <label className="form-label">
                Supplier / Vendor Name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="e.g. Dimo Lanka Auto Parts, United Motors"
                required
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Phone (Sri Lanka 10-digit)</label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="e.g. 011 234 5678 or 077 123 4567"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address / Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="e.g. Panchikawatta, Colombo 10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <textarea
                className="form-input"
                rows="2"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                placeholder="e.g. Supplies genuine Toyota & Nissan filters with 30-day credit term"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
