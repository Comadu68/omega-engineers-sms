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
  const [items, setItems] = useState([])
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
  const [suppliers, setSuppliers] = useState([])

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

  const loadInventory = async () => {
    try {
      setLoading(true)
      const filters = {
        search,
        category: selectedCategory !== 'all' ? selectedCategory : null,
        lowStockOnly
      }
      const [itemsList, sum, supps] = await Promise.all([
        window.omega.inventory.list(filters),
        window.omega.inventory.getSummary(),
        window.omega.inventory.getSuppliers()
      ])
      setItems(itemsList)
      setSummary(sum)
      setSuppliers(supps)
    } catch (err) {
      console.error('Failed to load inventory:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [search, selectedCategory, lowStockOnly])

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

  const openReceiveBatchFor = (item) => {
    setFormError('')
    setBatchForm({
      inventoryItemId: item.id,
      batchNo: '',
      supplierId: item.defaultSupplierId || (suppliers[0]?.id || ''),
      supplierDocumentNo: '',
      receivedAt: new Date().toISOString().slice(0, 10),
      receivedQty: '',
      unitCost: '',
      expiryDate: '',
      notes: ''
    })
    setIsReceiveBatchOpen(true)
  }

  const handleCreateItem = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!itemForm.name.trim()) {
      setFormError('Item name is required.')
      return
    }

    try {
      setIsSubmitting(true)
      let initialBatch = null
      if (parseFloat(itemForm.initialQty) > 0) {
        initialBatch = {
          qty: parseFloat(itemForm.initialQty),
          unitCost: parseFloat(itemForm.initialUnitCost) || 0,
          supplierId: itemForm.defaultSupplierId || null
        }
      }

      await window.omega.inventory.createItem({
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        category: itemForm.category,
        defaultSupplierId: itemForm.defaultSupplierId ? parseInt(itemForm.defaultSupplierId, 10) : null,
        minimumStockLevel: parseFloat(itemForm.minimumStockLevel) || 0,
        currentSellingPrice: parseFloat(itemForm.currentSellingPrice) || 0,
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
    const qty = parseFloat(batchForm.receivedQty)
    const cost = parseFloat(batchForm.unitCost)

    if (!batchForm.inventoryItemId || isNaN(qty) || qty <= 0) {
      setFormError('Valid item and positive received quantity are required.')
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
        unitCost: isNaN(cost) ? 0 : cost,
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
    try {
      setIsSubmitting(true)
      await window.omega.inventory.updateItem(editingItem.id, {
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        category: itemForm.category,
        defaultSupplierId: itemForm.defaultSupplierId ? parseInt(itemForm.defaultSupplierId, 10) : null,
        minimumStockLevel: parseFloat(itemForm.minimumStockLevel) || 0,
        currentSellingPrice: parseFloat(itemForm.currentSellingPrice) || 0,
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

  return (
    <div className="content-scrollable">
      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ '--accent-color': 'var(--primary)' }}>
          <div className="kpi-label">Total Item Masters</div>
          <div className="kpi-value">{summary.totalItems}</div>
          <div className="kpi-subtext">Registered catalog parts</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--danger)' }}>
          <div className="kpi-label">Low-Stock Alerts</div>
          <div className="kpi-value" style={{ color: summary.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            {summary.lowStockCount}
          </div>
          <div className="kpi-subtext">Below reorder minimum</div>
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

      {/* Toolbar & Action buttons */}
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
            ⚠️ Low Stock Only
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
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
            + Receive Stock Batch
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

      {/* Main Inventory Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading inventory stock...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No inventory items found. Click "+ Add New Item" to register parts.
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
                No stock batches received yet. Click "+ Receive New Batch" to add stock.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Batch No</th>
                    <th>Received Date</th>
                    <th>Supplier</th>
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
                <label className="form-label">Default Supplier</label>
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
          title="Receive Stock Batch (Replenishment)"
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
                <label className="form-label">Supplier</label>
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
                <label className="form-label">Supplier Invoice / Document No.</label>
                <input
                  type="text"
                  className="form-input"
                  value={batchForm.supplierDocumentNo}
                  onChange={(e) => setBatchForm({ ...batchForm, supplierDocumentNo: e.target.value })}
                  placeholder="e.g. GRN-2026-89"
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
          </form>
        </Modal>
      )}
    </div>
  )
}
