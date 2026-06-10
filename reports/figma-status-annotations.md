# Figma design — status-model annotation notes (extracted from Forethread.fig)

Source: on-canvas text annotations in `Forethread.fig` (canvas.fig). These are the design's
documentation sticky-notes, NOT Figma threaded comments (those are server-side, not in a .fig export).


---

```
Purchase Order (PO)\nPrimary lifecycle\n- Draft\n- Sent\n- Acknowledged\n- Accepted\n- Declined\n- Change pending\n- Cancelled\n- Cancelled by vendor\n- Closed\n- Invoiced\n- Dispute\n\nOptional lifecycle\n- Scheduled for delivery\n- Partially delivered\n- Delivered\n- Late for delivery\n- Not delivered\n- Separate status field\n\nApproval Status:\n- Not required\n- Pending\n- Approved\n- Rejected\n\nNotes\n- Draft and approval-related pre-issue states are contractor-only and not visible to the vendor.\n- Acknowledged is triggered by vendor action and then becomes the shared document status visible to both sides.\n- Vendor-triggered shared statuses include Accepted, Declined, Change pending, and Cancelled by vendor.\n- Delivery-related statuses apply only when the optional Delivery scope is enabled.
```


---

```
RFQ Status badge:\n\nPrimary lifecycle\n- Draft\n- Open\n- Closed\n- Cancelled\n\nSeparate stored state\n- Archived\n\nNotes\n- Open is the user-facing Release 1 status used in dashboards.\n- Internally, Sent and Active may still exist as system states grouped under Open.\n- Awarded should be treated as a dashboard preset / business label, not as a primary RFQ lifecycle status.\n\nOptional separate status field\n- Approval Status\n- Pending\n- Approved\n- Rejected\n\nNotes\nThis field exists only when 1.06 / 5.10 approval workflows are enabled.\n\nhttps://docs.google.com/document/d/1hiC2a7UsDR4sb2KTS92qqs8iR69dwZB8QktPO6AHP7Y/edit?tab=t.6w951mj62ng9#heading=h.dyfdlzpu6q0w
```
